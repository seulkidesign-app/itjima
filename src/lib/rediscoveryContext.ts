import type { RediscoveryMemory } from "@/lib/rediscoveryPick";

const HOUR = 60 * 60 * 1000;
export const RECENT_CONTEXT_WINDOW_MS = 36 * HOUR;

const STOPWORDS = new Set([
  "오늘",
  "내일",
  "어제",
  "이번",
  "저번",
  "나중",
  "다시",
  "기록",
  "생각",
  "메모",
  "하기",
  "할일",
  "일정",
  "그리고",
  "근데",
  "그냥",
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "later",
  "today",
  "tomorrow",
  "note",
  "remember",
]);

function trimKoreanParticle(token: string) {
  if (token.length <= 2) return token;
  const particles = [
    "에서",
    "으로",
    "에게",
    "한테",
    "부터",
    "까지",
    "처럼",
    "보다",
    "로",
    "은",
    "는",
    "이",
    "가",
    "을",
    "를",
    "에",
    "와",
    "과",
    "도",
    "만",
  ];
  for (const particle of particles) {
    if (token.endsWith(particle) && token.length - particle.length >= 2) {
      return token.slice(0, -particle.length);
    }
  }
  return token;
}

export function rediscoveryTopicTokens(text: string): string[] {
  const normalized = text
    .toLocaleLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^0-9a-z가-힣\s]/gi, " ");

  return [
    ...new Set(
      normalized
        .split(/\s+/)
        .map((token) => trimKoreanParticle(token.trim()))
        .filter((token) => token.length >= 2 && !STOPWORDS.has(token)),
    ),
  ].slice(0, 24);
}

export function rediscoveryContextScore(a: string, b: string): number {
  const aTokens = rediscoveryTopicTokens(a);
  const bTokens = new Set(rediscoveryTopicTokens(b));
  let score = 0;

  for (const token of aTokens) {
    if (!bTokens.has(token)) continue;
    score += token.length >= 4 ? 2 : 1;
  }

  return score;
}

function rediscoverySharedTokenCount(a: string, b: string): number {
  const aTokens = rediscoveryTopicTokens(a);
  const bTokens = new Set(rediscoveryTopicTokens(b));
  return aTokens.filter((token) => bTokens.has(token)).length;
}

export type RediscoveryContextMatch = {
  memory: RediscoveryMemory;
  score: number;
  sharedTokenCount: number;
};

/**
 * Find the strongest recent user-authored context for an older memory.
 *
 * This deliberately favors precision over recall. Exact token overlap is only
 * treated as a resurfacing signal when at least two distinct meaningful tokens
 * overlap. A single long word is not enough evidence to claim "same context".
 */
export function findRecentRediscoveryContext(
  memory: RediscoveryMemory,
  pool: RediscoveryMemory[],
  nowMs = Date.now(),
): RediscoveryContextMatch | null {
  const sourceText = memory.raw_text ?? memory.text;
  const matches = pool
    .filter((other) => other.id !== memory.id)
    .filter((other) => other.rediscovery_source === "record")
    .filter((other) => {
      const age = nowMs - new Date(other.created_at).getTime();
      return age >= 0 && age <= RECENT_CONTEXT_WINDOW_MS;
    })
    .map((other) => {
      const otherText = other.raw_text ?? other.text;
      return {
        memory: other,
        score: rediscoveryContextScore(sourceText, otherText),
        sharedTokenCount: rediscoverySharedTokenCount(sourceText, otherText),
      };
    })
    .filter((match) => match.sharedTokenCount >= 2 && match.score >= 2)
    .sort((a, b) => {
      if (b.sharedTokenCount !== a.sharedTokenCount) {
        return b.sharedTokenCount - a.sharedTokenCount;
      }
      if (b.score !== a.score) return b.score - a.score;
      return (
        new Date(b.memory.created_at).getTime() -
        new Date(a.memory.created_at).getTime()
      );
    });

  return matches[0] ?? null;
}
