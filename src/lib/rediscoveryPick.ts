import {
  archiveDisplayTitle,
  readArchiveVisits,
  readRediscoveryDismissed,
  writeRediscoveryDismissed,
} from "@/lib/archiveMeta";
import { formatRevivalAge } from "@/lib/memoryRevival";
import { findRelatedArchiveItems } from "@/lib/archiveSearch";
import type { ArchiveItem, ScheduleItem } from "@/lib/store";
import { remainingUntil } from "@/lib/scheduleTime";

export type RediscoveryPick = {
  memory: ArchiveItem;
  ageKo: string;
  ageEn: string;
  nudgeKo: string;
  nudgeEn: string;
  relatedSchedule?: ScheduleItem;
};

const SESSION_KEY = "itjima.rediscovery.session";

export function readRediscoverySessionShown(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

export function markRediscoverySessionShown() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, "1");
}

export function dismissRediscovery(memoryId: string) {
  const prev = readRediscoveryDismissed();
  writeRediscoveryDismissed([...prev, memoryId].slice(-40));
}

export function pickRediscoveryCandidate(
  archive: ArchiveItem[],
  schedules: ScheduleItem[],
): RediscoveryPick | null {
  if (!archive.length) return null;

  const dismissed = new Set(readRediscoveryDismissed());
  const visits = readArchiveVisits();
  const now = Date.now();
  const activeSchedules = schedules.filter((s) => s.status !== "done");

  const candidates = archive
    .filter((m) => !dismissed.has(m.id))
    .filter((m) => now - +new Date(m.created_at) >= 3 * 86400000)
    .map((memory) => {
      const linked = activeSchedules.find(
        (s) =>
          s.source_id === memory.id ||
          s.source_id === memory.source_id,
      );
      let daysUntil: number | undefined;
      if (linked) {
        const r = remainingUntil(new Date(linked.start_time));
        if (!r.past) daysUntil = r.days;
      }
      const ageMs = now - +new Date(memory.created_at);
      const visitPenalty = (visits[memory.id] ?? 0) * 86400000;
      const urgencyBoost =
        daysUntil !== undefined && daysUntil <= 7 ? 7 - daysUntil : 0;
      const score = ageMs - visitPenalty + urgencyBoost * 86400000 * 2;
      return { memory, linked, daysUntil, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = candidates[0];
  if (!top) return null;

  const { memory, linked, daysUntil } = top;
  const ageKo = formatRevivalAge(memory.created_at, "ko");
  const ageEn = formatRevivalAge(memory.created_at, "en");

  const visitCount = visits[memory.id] ?? 0;
  const ageDays = (now - +new Date(memory.created_at)) / 86400000;

  let nudgeKo: string;
  let nudgeEn: string;

  if (linked && daysUntil !== undefined && daysUntil <= 7) {
    nudgeKo =
      daysUntil <= 1
        ? "곧 그때가 와서, 이 생각을 다시 꺼내봤어요."
        : "그때가 다가와서, 이 생각을 다시 꺼내봤어요.";
    nudgeEn =
      daysUntil <= 1
        ? "That moment is almost here — so this thought came back."
        : "That moment is getting closer — so this thought came back.";
  } else if (ageDays >= 21 && visitCount <= 1) {
    nudgeKo = "그때의 내가 잊지 않으려고 남겨둔 생각이에요.";
    nudgeEn = "A thought you left so future-you wouldn't forget.";
  } else {
    nudgeKo = "오늘 다시 보면 좋을 것 같아요.";
    nudgeEn = "Worth another quiet look today.";
  }

  return {
    memory,
    ageKo,
    ageEn,
    nudgeKo,
    nudgeEn,
    relatedSchedule: linked,
  };
}

export function revivalHeaderKo(ageKo: string): string {
  if (ageKo === "오늘" || ageKo === "어제") {
    return `${ageKo} 남긴 생각이에요`;
  }
  return `${ageKo.replace(/ 전$/, " 전에")} 남긴 생각이에요`;
}

export function rediscoveryRelatedMemories(
  memory: ArchiveItem,
  pool: ArchiveItem[],
  limit = 3,
) {
  return findRelatedArchiveItems(memory, pool, limit).map((h) => h.item);
}
