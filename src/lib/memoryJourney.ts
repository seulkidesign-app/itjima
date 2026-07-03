import { archiveDisplayTitle, archiveSearchHaystack } from "@/lib/archiveMeta";
import {
  archiveDocument,
  memorySimilarity,
  tokenize,
} from "@/lib/archiveSearch";
import { STRONG_LINK } from "@/lib/memoryDiscovery";
import type { ThoughtLike } from "@/lib/thinkingInsights";

export type JourneyMomentKind =
  | "beginning"
  | "memory"
  | "connection"
  | "milestone"
  | "transition";

export type JourneyMoment = {
  id: string;
  kind: JourneyMomentKind;
  memoryId?: string;
  linkedId?: string;
  date: string;
  whisperKo?: string;
  whisperEn?: string;
  preview?: string;
};

export type JourneyChapter = {
  id: string;
  start: string;
  end: string;
  titleKo: string;
  titleEn: string;
  subtitleKo: string;
  subtitleEn: string;
  moments: JourneyMoment[];
  coverIds: string[];
  tone: number;
};

const GAP_DAYS = 21;
const RETURN_GAP_DAYS = 45;
const MIN_THOUGHTS = 4;
const MAX_CHAPTERS = 6;
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

function daysBetween(a: string, b: string) {
  return Math.abs(+new Date(a) - +new Date(b)) / (24 * 60 * 60 * 1000);
}

function seasonOf(d: Date): { ko: string; en: string } {
  const m = d.getMonth();
  if (m === 11 || m <= 1) return { ko: "겨울", en: "Winter" };
  if (m <= 4) return { ko: "봄", en: "Spring" };
  if (m <= 7) return { ko: "여름", en: "Summer" };
  return { ko: "가을", en: "Fall" };
}

function monthName(d: Date, lang: "ko" | "en") {
  return d.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
    month: "long",
  });
}

function chapterTitles(start: Date, end: Date): { ko: string; en: string } {
  const span = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  const sy = start.getFullYear();
  const ey = end.getFullYear();

  if (span <= 10) {
    const m = monthName(start, "ko");
    const me = monthName(start, "en");
    return {
      ko: `${m}의 며칠`,
      en: `A few days in ${me}`,
    };
  }

  const ss = seasonOf(start);
  const es = seasonOf(end);

  if (sy === ey && ss.ko === es.ko) {
    return {
      ko: `${ss.ko} ${sy}`,
      en: `${ss.en} ${sy}`,
    };
  }

  if (sy === ey) {
    return {
      ko: `${ss.ko}에서 ${es.ko}까지`,
      en: `${ss.en} into ${es.en}`,
    };
  }

  return {
    ko: `${sy} — ${ey}`,
    en: `${sy} — ${ey}`,
  };
}

function dominantTheme(thoughts: ThoughtLike[]): string | null {
  const freq = new Map<string, number>();
  for (const it of thoughts) {
    const seen = new Set<string>();
    for (const t of tokenize(archiveSearchHaystack(it))) {
      if (t.length < 2 || STOP.has(t) || seen.has(t)) continue;
      seen.add(t);
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 2) return null;
  const token = top[0];
  if (/^[a-z]/i.test(token)) return token.charAt(0).toUpperCase() + token.slice(1);
  return token;
}

function chapterSubtitle(
  thoughts: ThoughtLike[],
  opts: {
    isFirst: boolean;
    isReturn: boolean;
    theme: string | null;
  },
): { ko: string; en: string } {
  if (opts.isFirst) {
    return {
      ko: "모든 이야기는 하나의 생각에서 시작돼요.",
      en: "Every story starts with one thought.",
    };
  }
  if (opts.isReturn) {
    return {
      ko: "잠시 멈춘 뒤, 다시 이어졌어요.",
      en: "After a pause, you picked up the thread again.",
    };
  }
  if (opts.theme) {
    return {
      ko: `「${opts.theme}」에 대한 생각들`,
      en: `Thoughts about ${opts.theme}`,
    };
  }
  return {
    ko: "조용히 쌓인 생각들",
    en: "Thoughts that quietly gathered",
  };
}

function splitChapters(thoughts: ThoughtLike[]): ThoughtLike[][] {
  if (!thoughts.length) return [];
  const sorted = [...thoughts].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
  );
  const groups: ThoughtLike[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (daysBetween(prev.created_at, cur.created_at) >= GAP_DAYS) {
      groups.push([cur]);
    } else {
      groups[groups.length - 1].push(cur);
    }
  }

  const merged: ThoughtLike[][] = [];
  for (const g of groups) {
    if (g.length === 1 && merged.length) {
      merged[merged.length - 1].push(...g);
    } else if (g.length === 1 && !merged.length) {
      merged.push(g);
    } else {
      merged.push(g);
    }
  }
  return merged.filter((g) => g.length > 0);
}

function buildMoments(
  chapterThoughts: ThoughtLike[],
  corpus: ThoughtLike[],
  pins: Set<string>,
  isFirstChapter: boolean,
  gapBeforeDays: number,
): JourneyMoment[] {
  const moments: JourneyMoment[] = [];
  const sorted = [...chapterThoughts].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
  );

  if (isFirstChapter) {
    moments.push({
      id: `begin-${sorted[0].id}`,
      kind: "beginning",
      memoryId: sorted[0].id,
      date: sorted[0].created_at,
      whisperKo: "첫 생각",
      whisperEn: "Where it began",
      preview: sorted[0].text.split("\n")[0]?.slice(0, 80),
    });
  } else if (gapBeforeDays >= RETURN_GAP_DAYS) {
    moments.push({
      id: `return-${sorted[0].id}`,
      kind: "transition",
      memoryId: sorted[0].id,
      date: sorted[0].created_at,
      whisperKo: "다시 시작",
      whisperEn: "Picking up again",
      preview: sorted[0].text.split("\n")[0]?.slice(0, 80),
    });
  }

  const archiveCorpus = corpus.map((t) => t as Parameters<typeof archiveDocument>[0]);

  for (let i = 0; i < sorted.length; i++) {
    const it = sorted[i];
    const preview = (it.raw_text ?? it.text).trim().slice(0, 100);

    if (isFirstChapter && i === 0) {
      if (pins.has(it.id)) {
        moments.push({
          id: `milestone-${it.id}`,
          kind: "milestone",
          memoryId: it.id,
          date: it.created_at,
          whisperKo: "자주 돌아보는 기억",
          whisperEn: "A memory you keep close",
          preview,
        });
      }
      continue;
    }

    moments.push({
      id: `mem-${it.id}`,
      kind: pins.has(it.id) ? "milestone" : "memory",
      memoryId: it.id,
      date: it.created_at,
      preview,
    });

    if (pins.has(it.id) && !moments.some((m) => m.id === `milestone-${it.id}`)) {
      moments.push({
        id: `milestone-${it.id}`,
        kind: "milestone",
        memoryId: it.id,
        date: it.created_at,
        whisperKo: "자주 돌아보는 기억",
        whisperEn: "A memory you keep close",
        preview,
      });
    }

    const next = sorted[i + 1];
    if (!next) continue;

    const sim = memorySimilarity(
      it as Parameters<typeof archiveDocument>[0],
      next as Parameters<typeof archiveDocument>[0],
      archiveCorpus,
    );
    if (sim >= STRONG_LINK) {
      moments.push({
        id: `link-${it.id}-${next.id}`,
        kind: "connection",
        memoryId: it.id,
        linkedId: next.id,
        date: next.created_at,
        whisperKo: "이어지는 생각",
        whisperEn: "A thread that connects",
      });
    }
  }

  return moments;
}

/** Build life chapters from thoughts — memories, not metrics. */
export function buildMemoryJourney(
  thoughts: ThoughtLike[],
  pins: Set<string> = new Set(),
): JourneyChapter[] {
  if (thoughts.length < MIN_THOUGHTS) return [];

  const groups = splitChapters(thoughts);
  if (groups.length < 1) return [];

  const chapters: JourneyChapter[] = [];
  let prevEnd: string | null = null;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const start = new Date(group[0].created_at);
    const end = new Date(group[group.length - 1].created_at);
    const gapBefore = prevEnd
      ? daysBetween(prevEnd, group[0].created_at)
      : 0;
    const theme = dominantTheme(group);
    const titles = chapterTitles(start, end);
    const sub = chapterSubtitle(group, {
      isFirst: gi === 0,
      isReturn: gapBefore >= RETURN_GAP_DAYS,
      theme,
    });

    const moments = buildMoments(
      group,
      thoughts,
      pins,
      gi === 0,
      gapBefore,
    );

    const coverIds = group
      .slice(-3)
      .map((t) => t.id)
      .reverse();

    chapters.push({
      id: `ch-${group[0].id}`,
      start: group[0].created_at,
      end: group[group.length - 1].created_at,
      titleKo: titles.ko,
      titleEn: titles.en,
      subtitleKo: sub.ko,
      subtitleEn: sub.en,
      moments,
      coverIds,
      tone: gi % 5,
    });

    prevEnd = group[group.length - 1].created_at;
  }

  return chapters.slice(-MAX_CHAPTERS);
}

export function journeyCoverPreview(
  id: string,
  thoughts: ThoughtLike[],
): string {
  const it = thoughts.find((t) => t.id === id);
  if (!it) return "";
  return archiveDisplayTitle(id, it);
}
