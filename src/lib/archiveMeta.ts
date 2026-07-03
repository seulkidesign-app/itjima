const PIN_KEY = "itjima.archive.pinned";
const TAGS_KEY = "itjima.archive.tags";
const TITLE_KEY = "itjima.archive.titles";
const VISIT_KEY = "itjima.archive.visits";
const REVIVAL_KEY = "itjima.archive.revival";

export type RevivalHint = {
  newId: string;
  relatedIds: string[];
  at: number;
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(val));
  window.dispatchEvent(new CustomEvent("itjima:archive-meta"));
}

export function readArchivePins(): Set<string> {
  return new Set(readJSON<string[]>(PIN_KEY, []));
}

export function toggleArchivePin(id: string) {
  const pins = readArchivePins();
  if (pins.has(id)) pins.delete(id);
  else pins.add(id);
  writeJSON(PIN_KEY, [...pins]);
}

export function readArchiveTags(): Record<string, string[]> {
  return readJSON<Record<string, string[]>>(TAGS_KEY, {});
}

export function setArchiveTags(id: string, tags: string[]) {
  const all = readArchiveTags();
  if (tags.length) all[id] = tags;
  else delete all[id];
  writeJSON(TAGS_KEY, all);
}

export function readArchiveTitles(): Record<string, string> {
  return readJSON<Record<string, string>>(TITLE_KEY, {});
}

export function setArchiveTitle(id: string, title: string) {
  const all = readArchiveTitles();
  if (title.trim()) all[id] = title.trim();
  else delete all[id];
  writeJSON(TITLE_KEY, all);
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
  return readJSON<Record<string, number>>(VISIT_KEY, {});
}

export function recordArchiveVisit(id: string) {
  const visits = readArchiveVisits();
  visits[id] = (visits[id] ?? 0) + 1;
  writeJSON(VISIT_KEY, visits);
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
