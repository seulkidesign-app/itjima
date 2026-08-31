import { understandNaturalLanguage } from "@/lib/nlSchedule";

/**
 * Known schedule/place/task content already recognized elsewhere in production NL.
 * Used only as a positive title cue — never as typo autocorrect.
 */
const SCHEDULE_TITLE_CONTENT_RE =
  /(?:약속|미팅|회의|치과|병원|약국|학교|회사|공항|카페|식당|장보|전화|청소|운동|출근|교육|만나|스케일|강남|팀|세탁|약\b|출발|도착|기상|dentist|meeting|clinic|call|mom|appointment)/i;

const TITLE_ACTION_ENDING_RE = /(?:하기|가기|끄기|먹기|잡기|보기|보내기|제출)$/;

/** Exact known keywords that a 1-edit near-miss should not silently promote. */
const TYPABLE_SCHEDULE_KEYWORDS = [
  "병원",
  "치과",
  "약국",
  "회의",
  "미팅",
  "청소",
  "운동",
  "출근",
  "교육",
  "전화",
] as const;

function hangulEditDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 1) return 2;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dist[i][0] = i;
  for (let j = 0; j < cols; j += 1) dist[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + cost,
      );
    }
  }
  return dist[a.length][b.length];
}

/** One-edit lookalikes of known keywords stay fail-closed (no autocorrect). */
export function isNearMissScheduleKeyword(title: string): boolean {
  const value = title.trim();
  if (!value) return false;
  // Exact known content is never a "near miss" of a neighbor keyword
  // (e.g. 출발 ↔ 출근).
  if (SCHEDULE_TITLE_CONTENT_RE.test(value)) return false;
  for (const keyword of TYPABLE_SCHEDULE_KEYWORDS) {
    if (value === keyword) return false;
    if (hangulEditDistance(value, keyword) === 1) return true;
  }
  return false;
}

function hasPositiveScheduleTitleCue(title: string): boolean {
  const value = title.trim();
  if (!value) return false;
  if (SCHEDULE_TITLE_CONTENT_RE.test(value)) return true;
  if (TITLE_ACTION_ENDING_RE.test(value)) return true;
  if (/\s/.test(value)) return true;
  if (/[A-Za-z]{3,}/.test(value)) return true;
  return false;
}

/**
 * Temporal parse success ≠ auto-save permission.
 * A confident clock must not promote a low-confidence title/action.
 */
export function hasLowConfidenceScheduleTitle(
  title: string,
  lang: "ko" | "en",
): boolean {
  const value = title.trim();
  if (!value) return true;
  if (isNearMissScheduleKeyword(value)) return true;

  const nl = understandNaturalLanguage(value, lang);
  if (nl.confidence !== "low") return false;
  if (nl.intent !== "keep") return false;
  if (
    nl.category === "place" ||
    nl.category === "task" ||
    nl.category === "reminder" ||
    nl.category === "shopping"
  ) {
    return false;
  }

  return !hasPositiveScheduleTitleCue(value);
}
