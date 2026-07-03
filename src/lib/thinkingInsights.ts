import { archiveSearchHaystack } from "@/lib/archiveMeta";
import { tokenize } from "@/lib/archiveSearch";

export type ThoughtLike = {
  id: string;
  text: string;
  created_at: string;
  raw_text?: string | null;
  brain_mirror?: { title?: string; items?: string[] } | null;
};

export type InsightKind =
  | "recurring"
  | "growing"
  | "lasting"
  | "faded"
  | "curiosity";

export type ThinkingInsight = {
  id: string;
  kind: InsightKind;
  messageKo: string;
  messageEn: string;
  memoryIds: string[];
  weight: number;
};

const STOP = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "have",
  "from",
  "will",
  "내일",
  "오늘",
  "그리고",
  "하고",
  "해서",
  "하기",
  "하는",
  "것",
  "수",
  "등",
]);

const MIN_THOUGHTS = 5;
const MAX_INSIGHTS = 5;
const MIN_INSIGHTS = 1;

function haystack(item: ThoughtLike): string {
  return archiveSearchHaystack(item);
}

function daysAgo(iso: string) {
  return (Date.now() - +new Date(iso)) / (24 * 60 * 60 * 1000);
}

function spanDays(dates: number[]) {
  if (dates.length < 2) return 0;
  const sorted = [...dates].sort((a, b) => a - b);
  return (sorted[sorted.length - 1] - sorted[0]) / (24 * 60 * 60 * 1000);
}

function displayTheme(
  token: string,
  members: ThoughtLike[],
): string {
  for (const m of members) {
    const title = m.brain_mirror?.title?.trim();
    if (title && title.toLowerCase().includes(token.toLowerCase())) {
      return title.length > 24 ? `${title.slice(0, 22)}…` : title;
    }
    const line = m.text.split("\n")[0]?.trim() ?? "";
    if (line.length >= 3 && line.toLowerCase().includes(token.toLowerCase())) {
      return line.length > 24 ? `${line.slice(0, 22)}…` : line;
    }
  }
  if (/^[a-z]/i.test(token)) {
    return token.charAt(0).toUpperCase() + token.slice(1);
  }
  return token;
}

type TokenEntry = {
  docIds: string[];
  dates: number[];
  members: ThoughtLike[];
};

type TokenIndex = Map<string, TokenEntry>;

type Ranked = { token: string; entry: TokenEntry; w: number };

function buildTokenIndex(thoughts: ThoughtLike[]): TokenIndex {
  const index: TokenIndex = new Map();
  const byId = new Map(thoughts.map((t) => [t.id, t]));

  for (const it of thoughts) {
    const seen = new Set<string>();
    const ts = +new Date(it.created_at);
    for (const t of tokenize(haystack(it))) {
      if (t.length < 2 || STOP.has(t) || seen.has(t)) continue;
      seen.add(t);
      if (!index.has(t)) {
        index.set(t, { docIds: [], dates: [], members: [] });
      }
      const entry = index.get(t)!;
      if (!entry.docIds.includes(it.id)) {
        entry.docIds.push(it.id);
        entry.dates.push(ts);
        const member = byId.get(it.id);
        if (member) entry.members.push(member);
      }
    }
  }
  return index;
}

function msg(
  kind: InsightKind,
  theme: string,
): { ko: string; en: string } {
  switch (kind) {
    case "recurring":
      return {
        ko: `「${theme}」은 자주 떠오르는 생각이에요.`,
        en: `${theme} keeps coming back to you.`,
      };
    case "growing":
      return {
        ko: `요즘 「${theme}」에 마음이 많이 가네요.`,
        en: `${theme} has been on your mind lately.`,
      };
    case "lasting":
      return {
        ko: `「${theme}」은 한동안 곁에 있는 생각이에요.`,
        en: `${theme} has stayed with you for a while.`,
      };
    case "faded":
      return {
        ko: `「${theme}」은 잠시 멀어진 것 같아요.`,
        en: `${theme} has quietly faded for now.`,
      };
    case "curiosity":
      return {
        ko: `최근 「${theme}」이 새로 보이기 시작했어요.`,
        en: `Something new — ${theme} showed up recently.`,
      };
  }
}

function insightFrom(
  kind: InsightKind,
  token: string,
  entry: { docIds: string[]; dates: number[]; members: ThoughtLike[] },
  weight: number,
): ThinkingInsight {
  const theme = displayTheme(token, entry.members);
  const { ko, en } = msg(kind, theme);
  return {
    id: `${kind}-${token}`,
    kind,
    messageKo: ko,
    messageEn: en,
    memoryIds: entry.docIds.slice(0, 4),
    weight,
  };
}

function findRecurring(index: TokenIndex): ThinkingInsight | null {
  let best: Ranked | null = null;

  for (const [token, entry] of index) {
    if (entry.docIds.length < 3) continue;
    if (spanDays(entry.dates) < 14) continue;
    const w = entry.docIds.length * 1.2 + spanDays(entry.dates) / 30;
    if (!best || w > best.w) best = { token, entry, w };
  }
  return best ? insightFrom("recurring", best.token, best.entry, best.w) : null;
}

function findGrowing(index: TokenIndex): ThinkingInsight | null {
  let best: Ranked | null = null;

  for (const [token, entry] of index) {
    const recent = entry.dates.filter((d) => Date.now() - d <= 30 * 86400000);
    const prior = entry.dates.filter((d) => {
      const age = (Date.now() - d) / 86400000;
      return age > 30 && age <= 90;
    });
    if (recent.length < 2) continue;
    if (prior.length >= recent.length) continue;
    const w = recent.length * 2 + (prior.length === 0 ? 1.5 : 0);
    if (!best || w > best.w) best = { token, entry, w };
  }
  return best ? insightFrom("growing", best.token, best.entry, best.w) : null;
}

function findLasting(index: TokenIndex): ThinkingInsight | null {
  let best: Ranked | null = null;

  for (const [token, entry] of index) {
    if (entry.docIds.length < 3) continue;
    const span = spanDays(entry.dates);
    if (span < 90) continue;
    const w = span / 30 + entry.docIds.length;
    if (!best || w > best.w) best = { token, entry, w };
  }
  return best ? insightFrom("lasting", best.token, best.entry, best.w) : null;
}

function findFaded(index: TokenIndex): ThinkingInsight | null {
  let best: Ranked | null = null;

  for (const [token, entry] of index) {
    const past = entry.dates.filter((d) => {
      const age = daysAgo(new Date(d).toISOString());
      return age >= 45 && age <= 180;
    });
    const recent = entry.dates.filter((d) => daysAgo(new Date(d).toISOString()) < 45);
    if (past.length < 2 || recent.length > 0) continue;
    const w = past.length * 1.5;
    if (!best || w > best.w) best = { token, entry, w };
  }
  return best ? insightFrom("faded", best.token, best.entry, best.w) : null;
}

function findCuriosity(index: TokenIndex): ThinkingInsight | null {
  let best: Ranked | null = null;

  for (const [token, entry] of index) {
    const recent = entry.dates.filter((d) => daysAgo(new Date(d).toISOString()) <= 14);
    const older = entry.dates.filter((d) => daysAgo(new Date(d).toISOString()) > 14);
    if (recent.length < 2 || older.length > 0) continue;
    const w = recent.length * 2;
    if (!best || w > best.w) best = { token, entry, w };
  }
  return best ? insightFrom("curiosity", best.token, best.entry, best.w) : null;
}

/** Quiet self-reflection — max 5 human insights, no metrics. */
export function discoverThinkingInsights(
  thoughts: ThoughtLike[],
): ThinkingInsight[] {
  if (thoughts.length < MIN_THOUGHTS) return [];

  const index = buildTokenIndex(thoughts);
  const candidates = [
    findRecurring(index),
    findGrowing(index),
    findLasting(index),
    findFaded(index),
    findCuriosity(index),
  ].filter(Boolean) as ThinkingInsight[];

  if (!candidates.length) return [];

  candidates.sort((a, b) => b.weight - a.weight);

  const picked: ThinkingInsight[] = [];
  const usedKinds = new Set<InsightKind>();
  const usedThemes = new Set<string>();

  for (const c of candidates) {
    if (picked.length >= MAX_INSIGHTS) break;
    const themeKey = c.messageKo.slice(0, 12);
    if (usedKinds.has(c.kind) && picked.length >= 3) continue;
    if (usedThemes.has(themeKey)) continue;
    usedKinds.add(c.kind);
    usedThemes.add(themeKey);
    picked.push(c);
  }

  if (picked.length < MIN_INSIGHTS && candidates[0]) {
    return [candidates[0]];
  }

  return picked.slice(0, MAX_INSIGHTS);
}
