import { archiveDisplayTitle, archiveSearchHaystack, readArchiveVisits } from "@/lib/archiveMeta";
import {
  findRelatedArchiveItems,
  memorySimilarity,
  tokenize,
} from "@/lib/archiveSearch";
import { VERY_STRONG_LINK } from "@/lib/memoryDiscovery";
import type { ArchiveItem } from "@/lib/store";

export type MemoryLike = {
  id: string;
  text: string;
  raw_text?: string | null;
  created_at: string;
  brain_mirror?: ArchiveItem["brain_mirror"];
};

export type RevivalMatch = {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  score: number;
  theme?: string;
};

export type RevivalHint = {
  sourceId: string;
  sourceKind: "inbox" | "archive";
  primaryId: string;
  matches: RevivalMatch[];
  messageKo: string;
  messageEn: string;
  at: number;
};

const MIN_REVIVAL_AGE_DAYS = 2;

const STOP = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "내일",
  "오늘",
  "그리고",
  "하고",
  "해서",
]);

function asArchiveShape(item: MemoryLike): ArchiveItem {
  return item as ArchiveItem;
}

function sharedTheme(a: MemoryLike, b: MemoryLike): string | undefined {
  const ta = new Set(tokenize(archiveSearchHaystack(a)));
  const tb = new Set(tokenize(archiveSearchHaystack(b)));
  const shared = [...ta].filter(
    (t) => t.length >= 2 && !STOP.has(t) && tb.has(t),
  );
  if (!shared.length) return undefined;
  shared.sort((x, y) => y.length - x.length);
  return shared[0];
}

function isWinter(iso: string): boolean {
  const m = new Date(iso).getMonth();
  return m === 11 || m === 0 || m === 1;
}

export function formatRevivalAge(iso: string, lang: "ko" | "en"): string {
  const days = Math.floor(
    (Date.now() - +new Date(iso)) / (24 * 60 * 60 * 1000),
  );
  if (days < 1) return lang === "ko" ? "오늘" : "today";
  if (days === 1) return lang === "ko" ? "어제" : "yesterday";
  if (days < 7)
    return lang === "ko" ? `${days}일 전` : `${days} days ago`;
  if (days < 35) {
    const w = Math.round(days / 7);
    return lang === "ko" ? `${w}주 전` : `${w} week${w > 1 ? "s" : ""} ago`;
  }
  if (days < 400) {
    const mo = Math.round(days / 30);
    return lang === "ko" ? `${mo}개월 전` : `${mo} month${mo > 1 ? "s" : ""} ago`;
  }
  const yr = Math.round(days / 365);
  return lang === "ko" ? `${yr}년 전` : `${yr} year${yr > 1 ? "s" : ""} ago`;
}

function buildMessage(
  primary: RevivalMatch,
  newItem: MemoryLike,
  oldItem: MemoryLike,
): { ko: string; en: string } {
  const theme = primary.theme ?? sharedTheme(newItem, oldItem);

  if (theme && theme.length >= 2) {
    return {
      ko: `${theme}(으)로 떠올린 적이 있어요.`,
      en: `This reminds you of ${theme}.`,
    };
  }

  const winterGap =
    isWinter(primary.createdAt) &&
    daysBetween(primary.createdAt) >= 60;

  if (winterGap) {
    return {
      ko: "지난겨울, 비슷한 생각을 적었어요.",
      en: "You were thinking about this last winter.",
    };
  }

  const ageKo = formatRevivalAge(primary.createdAt, "ko");
  const ageEn = formatRevivalAge(primary.createdAt, "en");
  return {
    ko: `${ageKo} 비슷한 걸 적었어요.`,
    en: `You wrote something similar ${ageEn}.`,
  };
}

function daysBetween(iso: string) {
  return Math.floor(
    (Date.now() - +new Date(iso)) / (24 * 60 * 60 * 1000),
  );
}

/** Find strong prior memories for a newly created thought. */
export function findRevivalMatches(
  newItem: MemoryLike,
  pool: MemoryLike[],
  limit = 4,
): RevivalMatch[] {
  const others = pool.filter((it) => it.id !== newItem.id);
  if (!others.length) return [];

  const corpus = others.map(asArchiveShape);
  const hits = findRelatedArchiveItems(
    asArchiveShape(newItem),
    corpus,
    limit + 2,
    VERY_STRONG_LINK,
  );

  const matches: RevivalMatch[] = [];
  for (const hit of hits) {
    if (hit.item.id === newItem.id) continue;
    if (daysBetween(hit.item.created_at) < MIN_REVIVAL_AGE_DAYS) continue;
    const theme = sharedTheme(newItem, hit.item);
    matches.push({
      id: hit.item.id,
      title: archiveDisplayTitle(hit.item.id, hit.item),
      preview: (hit.item.raw_text ?? hit.item.text).trim().slice(0, 120),
      createdAt: hit.item.created_at,
      score: hit.score,
      theme,
    });
  }

  matches.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) > 0.05) return scoreDiff;
    return +new Date(a.createdAt) - +new Date(b.createdAt);
  });

  return matches.slice(0, limit);
}

export function buildRevivalHint(
  newItem: MemoryLike,
  pool: MemoryLike[],
  sourceKind: "inbox" | "archive",
): RevivalHint | null {
  const matches = findRevivalMatches(newItem, pool);
  if (!matches.length) return null;

  const visits = readArchiveVisits();
  const primary = matches.reduce((best, m) => {
    if (m.score > best.score + 0.04) return m;
    if (Math.abs(m.score - best.score) <= 0.04) {
      const bestVisits = visits[best.id] ?? 0;
      const mVisits = visits[m.id] ?? 0;
      if (mVisits < bestVisits) return m;
      if (
        mVisits === bestVisits &&
        +new Date(m.createdAt) < +new Date(best.createdAt)
      ) {
        return m;
      }
    }
    return best;
  }, matches[0]);

  const oldItem = pool.find((p) => p.id === primary.id);
  if (!oldItem) return null;

  const msg = buildMessage(primary, newItem, oldItem);

  return {
    sourceId: newItem.id,
    sourceKind,
    primaryId: primary.id,
    matches,
    messageKo: msg.ko,
    messageEn: msg.en,
    at: Date.now(),
  };
}

export function revivalJumpKey() {
  return "itjima.revival.jump";
}

export function setRevivalJumpTarget(memoryId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(revivalJumpKey(), memoryId);
}

export function consumeRevivalJumpTarget(): string | null {
  if (typeof window === "undefined") return null;
  const id = sessionStorage.getItem(revivalJumpKey());
  if (id) sessionStorage.removeItem(revivalJumpKey());
  return id;
}

/** Cross-check similarity for display confidence. */
export function revivalLinkScore(a: MemoryLike, b: MemoryLike, pool: MemoryLike[]) {
  return memorySimilarity(
    asArchiveShape(a),
    asArchiveShape(b),
    pool.map(asArchiveShape),
  );
}
