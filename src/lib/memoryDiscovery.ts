import type { ArchiveItem } from "@/lib/store";
import {
  archiveDocument,
  tokenize,
  memorySimilarity,
  findRelatedArchiveItems,
} from "@/lib/archiveSearch";

/** Only surface relationships we are confident about. */
export const STRONG_LINK = 0.28;
export const VERY_STRONG_LINK = 0.36;
const RECURRING_MIN_DOCS = 3;
const RECENT_DAYS = 14;
const GROWING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type MemoryLensKind =
  | "revisited"
  | "connected"
  | "similar"
  | "recurring"
  | "growing";

export type MemoryLens = {
  id: string;
  kind: MemoryLensKind;
  labelKo: string;
  labelEn: string;
  memoryIds: string[];
};

const KIND_LABEL: Record<
  MemoryLensKind,
  { ko: string; en: string }
> = {
  revisited: { ko: "자주 떠올리는", en: "Often revisited" },
  connected: { ko: "최근 이어진", en: "Recently connected" },
  similar: { ko: "닮은 생각", en: "Similar threads" },
  recurring: { ko: "반복되는 주제", en: "Recurring themes" },
  growing: { ko: "자라는 관심", en: "Growing interests" },
};

function sharedThemeLabel(
  members: ArchiveItem[],
  maxTerms = 3,
): { ko: string; en: string } | null {
  if (members.length < 2) return null;
  const docFreq = new Map<string, number>();
  for (const it of members) {
    const seen = new Set<string>();
    for (const t of tokenize(archiveDocument(it))) {
      if (t.length < 2 || seen.has(t)) continue;
      seen.add(t);
      docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    }
  }
  const minDocs = Math.max(2, Math.ceil(members.length * 0.5));
  const shared = [...docFreq.entries()]
    .filter(([, c]) => c >= minDocs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms)
    .map(([t]) => t);
  if (!shared.length) return null;
  const label = shared.join(" · ");
  return { ko: label, en: label };
}

function lensLabel(
  kind: MemoryLensKind,
  members: ArchiveItem[],
): { labelKo: string; labelEn: string } {
  const theme = sharedThemeLabel(members);
  const base = KIND_LABEL[kind];
  if (theme) {
    return { labelKo: theme.ko, labelEn: theme.en };
  }
  return { labelKo: base.ko, labelEn: base.en };
}

function idsKey(ids: string[]) {
  return [...ids].sort().join(",");
}

function daysAgo(iso: string) {
  return (Date.now() - +new Date(iso)) / (24 * 60 * 60 * 1000);
}

function clusterAvgSim(members: ArchiveItem[], corpus: ArchiveItem[]): number {
  if (members.length < 2) return 0;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      sum += memorySimilarity(members[i], members[j], corpus);
      n++;
    }
  }
  return n ? sum / n : 0;
}

function buildRevisitedLens(
  items: ArchiveItem[],
  visits: Record<string, number>,
): MemoryLens | null {
  const ranked = items
    .filter((it) => (visits[it.id] ?? 0) >= 2)
    .sort((a, b) => (visits[b.id] ?? 0) - (visits[a.id] ?? 0));
  if (!ranked.length) return null;

  const seed = ranked[0];
  const related = findRelatedArchiveItems(seed, items, 8).filter(
    (h) => h.score >= STRONG_LINK,
  );
  const ids = [
    seed.id,
    ...related.map((h) => h.item.id).filter((id) => id !== seed.id),
  ].slice(0, 5);
  if (ids.length < 2) return null;

  const members = ids
    .map((id) => items.find((x) => x.id === id))
    .filter(Boolean) as ArchiveItem[];
  const { labelKo, labelEn } = lensLabel("revisited", members);
  return {
    id: `revisited-${idsKey(ids)}`,
    kind: "revisited",
    labelKo,
    labelEn,
    memoryIds: ids,
  };
}

function buildConnectedLens(items: ArchiveItem[]): MemoryLens | null {
  const recent = items.filter((it) => daysAgo(it.created_at) <= RECENT_DAYS);
  if (recent.length < 2) return null;

  let bestPair: [ArchiveItem, ArchiveItem] | null = null;
  let bestScore = 0;
  for (let i = 0; i < recent.length; i++) {
    for (let j = i + 1; j < recent.length; j++) {
      const score = memorySimilarity(recent[i], recent[j], items);
      if (score >= VERY_STRONG_LINK && score > bestScore) {
        bestScore = score;
        bestPair = [recent[i], recent[j]];
      }
    }
  }
  if (!bestPair) return null;

  const ids = bestPair.map((it) => it.id);
  const { labelKo, labelEn } = lensLabel("connected", bestPair);
  return {
    id: `connected-${idsKey(ids)}`,
    kind: "connected",
    labelKo,
    labelEn,
    memoryIds: ids,
  };
}

function buildSimilarLens(items: ArchiveItem[]): MemoryLens | null {
  const pairs: { ids: string[]; score: number; members: ArchiveItem[] }[] =
    [];
  const cap = Math.min(items.length, 80);
  const slice = items.slice(0, cap);

  for (let i = 0; i < slice.length; i++) {
    for (let j = i + 1; j < slice.length; j++) {
      const score = memorySimilarity(slice[i], slice[j], items);
      if (score >= VERY_STRONG_LINK) {
        pairs.push({
          ids: [slice[i].id, slice[j].id],
          score,
          members: [slice[i], slice[j]],
        });
      }
    }
  }
  if (!pairs.length) return null;
  pairs.sort((a, b) => b.score - a.score);
  const top = pairs[0];
  const { labelKo, labelEn } = lensLabel("similar", top.members);
  return {
    id: `similar-${idsKey(top.ids)}`,
    kind: "similar",
    labelKo,
    labelEn,
    memoryIds: top.ids,
  };
}

function buildRecurringLens(items: ArchiveItem[]): MemoryLens | null {
  const tokenDocs = new Map<string, Set<string>>();
  for (const it of items) {
    const seen = new Set<string>();
    for (const t of tokenize(archiveDocument(it))) {
      if (t.length < 2 || seen.has(t)) continue;
      seen.add(t);
      if (!tokenDocs.has(t)) tokenDocs.set(t, new Set());
      tokenDocs.get(t)!.add(it.id);
    }
  }

  const candidates = [...tokenDocs.entries()]
    .filter(([, ids]) => ids.size >= RECURRING_MIN_DOCS)
    .sort((a, b) => b[1].size - a[1].size);

  for (const [, idSet] of candidates) {
    const members = [...idSet]
      .map((id) => items.find((x) => x.id === id))
      .filter(Boolean) as ArchiveItem[];
    if (members.length < RECURRING_MIN_DOCS) continue;
    if (clusterAvgSim(members, items) < STRONG_LINK * 0.85) continue;
    const ids = members.slice(0, 6).map((m) => m.id);
    const { labelKo, labelEn } = lensLabel("recurring", members);
    return {
      id: `recurring-${idsKey(ids)}`,
      kind: "recurring",
      labelKo,
      labelEn,
      memoryIds: ids,
    };
  }
  return null;
}

function buildGrowingLens(items: ArchiveItem[]): MemoryLens | null {
  const now = Date.now();
  const recent: ArchiveItem[] = [];
  const older: ArchiveItem[] = [];
  for (const it of items) {
    const age = now - +new Date(it.created_at);
    if (age <= GROWING_WINDOW_MS) recent.push(it);
    else if (age <= GROWING_WINDOW_MS * 2) older.push(it);
  }
  if (recent.length < 2) return null;

  const recentTokens = new Map<string, number>();
  const olderTokens = new Set<string>();
  for (const it of older) {
    for (const t of tokenize(archiveDocument(it))) olderTokens.add(t);
  }
  for (const it of recent) {
    const seen = new Set<string>();
    for (const t of tokenize(archiveDocument(it))) {
      if (t.length < 2 || seen.has(t) || olderTokens.has(t)) continue;
      seen.add(t);
      recentTokens.set(t, (recentTokens.get(t) ?? 0) + 1);
    }
  }

  const rising = [...recentTokens.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])[0];
  if (!rising) return null;

  const [token] = rising;
  const members = recent.filter((it) =>
    tokenize(archiveDocument(it)).includes(token),
  );
  if (members.length < 2) return null;
  if (clusterAvgSim(members, items) < STRONG_LINK * 0.85) return null;

  const ids = members.slice(0, 5).map((m) => m.id);
  const { labelKo, labelEn } = lensLabel("growing", members);
  return {
    id: `growing-${idsKey(ids)}`,
    kind: "growing",
    labelKo,
    labelEn,
    memoryIds: ids,
  };
}

/** Ephemeral discovery lenses — references only, never duplicates memories. */
export function discoverMemoryLenses(
  items: ArchiveItem[],
  visits: Record<string, number>,
): MemoryLens[] {
  if (items.length < 2) return [];

  const builders = [
    () => buildRevisitedLens(items, visits),
    () => buildConnectedLens(items),
    () => buildSimilarLens(items),
    () => buildRecurringLens(items),
    () => buildGrowingLens(items),
  ];

  const seen = new Set<string>();
  const lenses: MemoryLens[] = [];
  const usedKinds = new Set<MemoryLensKind>();

  for (const build of builders) {
    const lens = build();
    if (!lens || lens.memoryIds.length < 2) continue;
    const key = idsKey(lens.memoryIds);
    if (seen.has(key)) continue;
    if (usedKinds.has(lens.kind)) continue;
    seen.add(key);
    usedKinds.add(lens.kind);
    lenses.push(lens);
    if (lenses.length >= 4) break;
  }

  return lenses;
}

/** High-confidence related memories for revival hints (min 1, strict threshold). */
export function findStronglyRelatedMemories(
  target: ArchiveItem,
  items: ArchiveItem[],
  limit = 4,
) {
  return findRelatedArchiveItems(target, items, limit, VERY_STRONG_LINK);
}
