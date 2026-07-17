import type { RevivalHint } from "@/lib/memoryRevival";

export type { RevivalHint };

export type ArchiveGroupDef = {
  key: string;
  ko: string;
  en: string;
  emoji: string;
  custom?: boolean;
};

export type ArchiveMetaPayload = {
  pins: string[];
  titles: Record<string, string>;
  tags: Record<string, string[]>;
  visits: Record<string, number>;
  groupOverrides: Record<string, string>;
  customGroups: ArchiveGroupDef[];
  collapsed: string[];
  schedulePins: string[];
  updatedAt: number;
};

const GUEST = "guest";

const LEGACY_KEYS: Record<string, string> = {
  pinned: "itjima.archive.pinned",
  titles: "itjima.archive.titles",
  tags: "itjima.archive.tags",
  visits: "itjima.archive.visits",
  group_overrides: "itjima.archive_group_overrides",
  custom_groups: "itjima.archive_custom_groups",
  collapsed: "itjima.archive_collapsed",
  schedule_pinned: "itjima.schedule.pinned",
};

/** Device-local ephemeral revival hint — not synced. */
const REVIVAL_KEY = "itjima.archive.revival";
const REDISCOVERY_DISMISS_KEY = "itjima.rediscovery.dismissed";

let metaUserId: string | null = null;

export function setArchiveMetaUserId(userId: string | null) {
  if (metaUserId === userId) return;
  metaUserId = userId;
  migrateLegacyArchiveMeta(userId);
}

function metaBucket() {
  return `itjima.${metaUserId ?? GUEST}.archive`;
}

function metaKey(suffix: string) {
  return `${metaBucket()}.${suffix}`;
}

function schedulePinKey() {
  return `itjima.${metaUserId ?? GUEST}.schedule.pinned`;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSONQuiet(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(val));
}

function writeJSON(key: string, val: unknown) {
  writeJSONQuiet(key, val);
  window.dispatchEvent(new CustomEvent("itjima:archive-meta"));
}

function notifyMetaChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("itjima:archive-meta"));
}

function migrateLegacyArchiveMeta(userId: string | null) {
  if (typeof window === "undefined") return;
  const pairs: Array<[string, string]> = [
    [metaKey("pinned"), LEGACY_KEYS.pinned],
    [metaKey("titles"), LEGACY_KEYS.titles],
    [metaKey("tags"), LEGACY_KEYS.tags],
    [metaKey("visits"), LEGACY_KEYS.visits],
    [metaKey("group_overrides"), LEGACY_KEYS.group_overrides],
    [metaKey("custom_groups"), LEGACY_KEYS.custom_groups],
    [metaKey("collapsed"), LEGACY_KEYS.collapsed],
    [schedulePinKey(), LEGACY_KEYS.schedule_pinned],
  ];
  for (const [nextKey, legacyKey] of pairs) {
    if (!localStorage.getItem(nextKey) && localStorage.getItem(legacyKey)) {
      localStorage.setItem(nextKey, localStorage.getItem(legacyKey)!);
    }
  }
  if (userId) {
    const guestBucket = `itjima.${GUEST}.archive`;
    for (const suffix of [
      "pinned",
      "titles",
      "tags",
      "visits",
      "group_overrides",
      "custom_groups",
      "collapsed",
    ]) {
      const guestKey = `${guestBucket}.${suffix}`;
      const userKey = metaKey(suffix);
      if (!localStorage.getItem(userKey) && localStorage.getItem(guestKey)) {
        localStorage.setItem(userKey, localStorage.getItem(guestKey)!);
      }
    }
    const guestSchedule = `itjima.${GUEST}.schedule.pinned`;
    if (
      !localStorage.getItem(schedulePinKey()) &&
      localStorage.getItem(guestSchedule)
    ) {
      localStorage.setItem(schedulePinKey(), localStorage.getItem(guestSchedule)!);
    }
  }
}

export function readArchiveMetaPayload(): ArchiveMetaPayload {
  return {
    pins: readJSON<string[]>(metaKey("pinned"), []),
    titles: readJSON<Record<string, string>>(metaKey("titles"), {}),
    tags: readJSON<Record<string, string[]>>(metaKey("tags"), {}),
    visits: readJSON<Record<string, number>>(metaKey("visits"), {}),
    groupOverrides: readJSON<Record<string, string>>(
      metaKey("group_overrides"),
      {},
    ),
    customGroups: readJSON<ArchiveGroupDef[]>(metaKey("custom_groups"), []),
    collapsed: readJSON<string[]>(metaKey("collapsed"), []),
    schedulePins: readJSON<string[]>(schedulePinKey(), []),
    updatedAt: readJSON<number>(metaKey("meta_updated_at"), 0),
  };
}

export function writeArchiveMetaPayload(payload: ArchiveMetaPayload) {
  writeJSONQuiet(metaKey("pinned"), payload.pins);
  writeJSONQuiet(metaKey("titles"), payload.titles);
  writeJSONQuiet(metaKey("tags"), payload.tags);
  writeJSONQuiet(metaKey("visits"), payload.visits);
  writeJSONQuiet(metaKey("group_overrides"), payload.groupOverrides);
  writeJSONQuiet(metaKey("custom_groups"), payload.customGroups);
  writeJSONQuiet(metaKey("collapsed"), payload.collapsed);
  writeJSONQuiet(schedulePinKey(), payload.schedulePins);
  writeJSONQuiet(metaKey("meta_updated_at"), payload.updatedAt);
  notifyMetaChange();
}

export function readArchivePins(): Set<string> {
  return new Set(readJSON<string[]>(metaKey("pinned"), []));
}

export function toggleArchivePin(id: string) {
  const pins = readArchivePins();
  if (pins.has(id)) pins.delete(id);
  else pins.add(id);
  writeJSON(metaKey("pinned"), [...pins]);
  touchMetaUpdatedAt();
}

export function readArchiveTags(): Record<string, string[]> {
  return readJSON<Record<string, string[]>>(metaKey("tags"), {});
}

export function setArchiveTags(id: string, tags: string[]) {
  const all = readArchiveTags();
  if (tags.length) all[id] = tags;
  else delete all[id];
  writeJSON(metaKey("tags"), all);
  touchMetaUpdatedAt();
}

export function readArchiveTitles(): Record<string, string> {
  return readJSON<Record<string, string>>(metaKey("titles"), {});
}

export function setArchiveTitle(id: string, title: string) {
  const all = readArchiveTitles();
  if (title.trim()) all[id] = title.trim();
  else delete all[id];
  writeJSON(metaKey("titles"), all);
  touchMetaUpdatedAt();
}

export function archiveDisplayTitle(
  id: string,
  item: { text: string; brain_mirror?: { title?: string } | null },
): string {
  const custom = readArchiveTitles()[id];
  if (custom) return custom;
  const bm = item.brain_mirror?.title?.trim();
  if (bm) return bm;
  return item.text.split("\n")[0]?.trim() || item.text;
}

export function archiveSearchHaystack(item: {
  text: string;
  raw_text?: string | null;
  brain_mirror?: { title?: string; items?: string[] } | null;
}): string {
  const parts = [
    item.text,
    item.raw_text ?? "",
    item.brain_mirror?.title ?? "",
    ...(item.brain_mirror?.items ?? []),
  ];
  return parts.join("\n").toLowerCase();
}

export function readArchiveVisits(): Record<string, number> {
  return readJSON<Record<string, number>>(metaKey("visits"), {});
}

export function recordArchiveVisit(id: string) {
  const visits = readArchiveVisits();
  visits[id] = (visits[id] ?? 0) + 1;
  writeJSON(metaKey("visits"), visits);
  touchMetaUpdatedAt();
}

export function readGroupOverrides(): Record<string, string> {
  return readJSON<Record<string, string>>(metaKey("group_overrides"), {});
}

export function writeGroupOverrides(next: Record<string, string>) {
  writeJSON(metaKey("group_overrides"), next);
  touchMetaUpdatedAt();
}

export function readCustomGroups(): ArchiveGroupDef[] {
  return readJSON<ArchiveGroupDef[]>(metaKey("custom_groups"), []);
}

export function writeCustomGroups(next: ArchiveGroupDef[]) {
  writeJSON(metaKey("custom_groups"), next);
  touchMetaUpdatedAt();
}

export function readCollapsedGroups(): Set<string> {
  return new Set(readJSON<string[]>(metaKey("collapsed"), []));
}

export function writeCollapsedGroups(next: string[]) {
  writeJSON(metaKey("collapsed"), next);
  touchMetaUpdatedAt();
}

// Auto-classification into keyword-based groups (e.g. "기타") is opt-in —
// off by default. Users must explicitly turn it on; otherwise items stay
// ungrouped rather than being silently sorted into categories they didn't
// choose.
export function readAutoClassify(): boolean {
  return readJSON<boolean>(metaKey("auto_classify"), false);
}

export function writeAutoClassify(value: boolean) {
  writeJSON(metaKey("auto_classify"), value);
  touchMetaUpdatedAt();
}

export function readSchedulePins(): Set<string> {
  return new Set(readJSON<string[]>(schedulePinKey(), []));
}

export function writeSchedulePins(ids: Set<string>) {
  writeJSON(schedulePinKey(), [...ids]);
  touchMetaUpdatedAt();
}

function touchMetaUpdatedAt() {
  if (typeof window === "undefined") return;
  localStorage.setItem(metaKey("meta_updated_at"), String(Date.now()));
}

export function setRevivalHint(hint: RevivalHint) {
  writeJSON(REVIVAL_KEY, hint);
}

export function readRevivalHint(): RevivalHint | null {
  const raw = readJSON<RevivalHint | null>(REVIVAL_KEY, null);
  if (!raw) return null;
  if (Date.now() - raw.at > 7 * 24 * 60 * 60 * 1000) {
    writeJSON(REVIVAL_KEY, null);
    return null;
  }
  return raw;
}

export function clearRevivalHint() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REVIVAL_KEY);
  window.dispatchEvent(new CustomEvent("itjima:archive-meta"));
}

export function readRediscoveryDismissed(): string[] {
  return readJSON<string[]>(REDISCOVERY_DISMISS_KEY, []);
}

export function writeRediscoveryDismissed(ids: string[]) {
  writeJSON(REDISCOVERY_DISMISS_KEY, ids);
}
