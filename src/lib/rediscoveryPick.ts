import {
  archiveDisplayTitle,
  readArchiveVisits,
  readRediscoveryDismissed,
  writeRediscoveryDismissed,
} from "@/lib/archiveMeta";
import { formatRevivalAge } from "@/lib/memoryRevival";
import { findRelatedArchiveItems } from "@/lib/archiveSearch";
import type { ArchiveItem, InboxItem, ScheduleItem } from "@/lib/store";
import { remainingUntil } from "@/lib/scheduleTime";

export type RediscoverySource = "record" | "archive";

export type RediscoveryMemory = ArchiveItem & {
  rediscovery_source: RediscoverySource;
};

export type RediscoveryPick = {
  memory: RediscoveryMemory;
  key: string;
  ageKo: string;
  ageEn: string;
  nudgeKo: string;
  nudgeEn: string;
  relatedSchedule?: ScheduleItem;
};

const SESSION_KEY = "itjima.rediscovery.session";
const SNOOZE_KEY = "itjima.rediscovery.snoozed";
const DEFAULT_SNOOZE_MS = 3 * 86400000;

function memoryKey(memory: Pick<ArchiveItem, "id" | "source_id">) {
  return memory.source_id ?? memory.id;
}

function readSessionIds(): string[] {
  if (typeof sessionStorage === "undefined") return [];
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw || raw === "1") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function readRediscoverySessionShown(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(SESSION_KEY) !== null;
}

export function markRediscoverySessionShown(memoryId?: string) {
  if (typeof sessionStorage === "undefined") return;
  if (!memoryId) {
    sessionStorage.setItem(SESSION_KEY, "1");
    return;
  }
  const next = [...new Set([...readSessionIds(), memoryId])].slice(-20);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

function readSnoozed(): Record<string, number> {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

export function snoozeRediscovery(memoryId: string, until = Date.now() + DEFAULT_SNOOZE_MS) {
  if (typeof localStorage === "undefined") return;
  const prev = readSnoozed();
  localStorage.setItem(SNOOZE_KEY, JSON.stringify({ ...prev, [memoryId]: until }));
}

export function dismissRediscovery(memoryId: string) {
  const prev = readRediscoveryDismissed();
  writeRediscoveryDismissed([...new Set([...prev, memoryId])].slice(-40));
}

/**
 * Rediscovery must work from normal Capture behavior. Canonical active records
 * are the primary source; legacy Archive rows are only a compatibility source.
 * If an Archive row points at an active canonical record, keep the canonical
 * version so one user thought cannot become two Rediscovery candidates.
 */
export function buildRediscoveryPool(
  inbox: InboxItem[],
  archive: ArchiveItem[],
): RediscoveryMemory[] {
  const canonical = inbox
    .filter((item) => (item.status ?? "active") === "active")
    .filter((item) => item.clarification_state !== "pending")
    .map<RediscoveryMemory>((item) => ({
      id: item.id,
      text: item.text,
      raw_text: item.raw_text,
      images: item.images ?? [],
      created_at: item.created_at,
      brain_mirror: item.brain_mirror,
      rediscovery_source: "record",
    }));

  const canonicalIds = new Set(canonical.map((item) => item.id));
  const legacyArchive = archive
    .filter((item) => !canonicalIds.has(memoryKey(item)))
    .map<RediscoveryMemory>((item) => ({
      ...item,
      rediscovery_source: "archive",
    }));

  return [...canonical, ...legacyArchive];
}

export function rediscoveryDisplayTitle(memory: RediscoveryMemory): string {
  if (memory.rediscovery_source === "archive") {
    return archiveDisplayTitle(memory.id, memory);
  }
  const brainTitle = memory.brain_mirror?.title?.trim();
  if (brainTitle) return brainTitle;
  return memory.text.split("\n")[0]?.trim() || memory.text;
}

export function pickRediscoveryCandidate(
  pool: RediscoveryMemory[],
  schedules: ScheduleItem[],
): RediscoveryPick | null {
  if (!pool.length) return null;

  const dismissed = new Set(readRediscoveryDismissed());
  const sessionShown = new Set(readSessionIds());
  const snoozed = readSnoozed();
  const visits = readArchiveVisits();
  const now = Date.now();
  const activeSchedules = schedules.filter((s) => s.status !== "done");

  const candidates = pool
    .filter((memory) => {
      const key = memoryKey(memory);
      if (dismissed.has(key) || sessionShown.has(key)) return false;
      const snoozeUntil = snoozed[key] ?? 0;
      return !Number.isFinite(snoozeUntil) || snoozeUntil <= now;
    })
    .filter((memory) => now - +new Date(memory.created_at) >= 3 * 86400000)
    .map((memory) => {
      const key = memoryKey(memory);
      const linked = activeSchedules.find(
        (s) => s.source_id === memory.id || s.source_id === memory.source_id,
      );
      let daysUntil: number | undefined;
      if (linked) {
        const r = remainingUntil(new Date(linked.start_time));
        if (!r.past) daysUntil = r.days;
      }
      const ageMs = now - +new Date(memory.created_at);
      const visitPenalty = (visits[key] ?? 0) * 86400000;
      const urgencyBoost =
        daysUntil !== undefined && daysUntil <= 7 ? 7 - daysUntil : 0;
      const score = ageMs - visitPenalty + urgencyBoost * 86400000 * 2;
      return { memory, key, linked, daysUntil, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = candidates[0];
  if (!top) return null;

  const { memory, key, linked, daysUntil } = top;
  const ageKo = formatRevivalAge(memory.created_at, "ko");
  const ageEn = formatRevivalAge(memory.created_at, "en");

  const visitCount = visits[key] ?? 0;
  const ageDays = (now - +new Date(memory.created_at)) / 86400000;

  let nudgeKo: string;
  let nudgeEn: string;

  if (linked && daysUntil !== undefined && daysUntil <= 7) {
    nudgeKo =
      daysUntil <= 1
        ? "곧 그때가 와서, 이 기록을 다시 보여드려요."
        : "그때가 다가와서, 이 기록을 다시 보여드려요.";
    nudgeEn =
      daysUntil <= 1
        ? "That moment is almost here, so this record is back."
        : "That moment is getting closer, so this record is back.";
  } else if (ageDays >= 21 && visitCount <= 1) {
    nudgeKo = "한동안 보지 않았던 기록이에요.";
    nudgeEn = "A record you haven't seen in a while.";
  } else {
    nudgeKo = "오늘 다시 볼 만한 기록이에요.";
    nudgeEn = "A record that may be worth another look today.";
  }

  return {
    memory,
    key,
    ageKo,
    ageEn,
    nudgeKo,
    nudgeEn,
    relatedSchedule: linked,
  };
}

export function revivalHeaderKo(ageKo: string): string {
  if (ageKo === "오늘" || ageKo === "어제") {
    return `${ageKo} 남긴 기록`;
  }
  return `${ageKo.replace(/ 전$/, " 전에")} 남긴 기록`;
}

export function rediscoveryRelatedMemories(
  memory: ArchiveItem,
  pool: ArchiveItem[],
  limit = 3,
) {
  return findRelatedArchiveItems(memory, pool, limit).map((h) => h.item);
}
