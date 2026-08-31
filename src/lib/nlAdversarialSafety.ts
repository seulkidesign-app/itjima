export type AdversarialScheduleReason =
  | "invalid_clock"
  | "duration_clock_collision"
  | "conflicting_dates"
  | "unsafe_clock_range"
  | "semantic_meta"
  | "malformed_clock"
  | "multi_clause";

const KO_MERIDIEM_CLOCK_RE = /(오전|오후)\s*(\d{1,2})\s*시(?!\s*간)(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/g;
const KO_BARE_CLOCK_RE = /(?:^|[^0-9가-힣])([0-9]{1,2})\s*시(?!\s*간)/g;
const EN_AMPM_CLOCK_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
const ASCII_COLON_RE = /(?:^|\D)(\d{1,2}):(\d{2})(?!\d)/g;

/** Malformed wall clocks must never be normalized into a plausible time. */
export function hasInvalidClockExpression(text: string): boolean {
  const value = text.trim();
  if (!value) return false;

  for (const match of value.matchAll(KO_MERIDIEM_CLOCK_RE)) {
    const hour = Number(match[2]);
    const minute = match[3] === "반" ? 30 : match[4] ? Number(match[4]) : 0;
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return true;
  }

  for (const match of value.matchAll(KO_BARE_CLOCK_RE)) {
    const hour = Number(match[1]);
    if (hour < 0 || hour > 23) return true;
  }

  for (const match of value.matchAll(EN_AMPM_CLOCK_RE)) {
    const hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return true;
  }

  for (const match of value.matchAll(ASCII_COLON_RE)) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return true;
  }

  return false;
}

/** `오후 2시간 영화` is a duration, not 14:00. */
export function hasDurationClockCollision(text: string): boolean {
  return /(?:오전|오후)\s*(?:\d+|한|두|세|네)\s*시간(?!\s*(?:뒤|후))/.test(text.trim());
}

function countDateAnchors(text: string): number {
  const value = text.trim();
  if (!value) return 0;
  const anchors = [
    ...value.matchAll(/오늘|내일|모레|글피/g),
    ...value.matchAll(/(?:일|월|화|수|목|금|토)요일/g),
    ...value.matchAll(/\b(?:today|tomorrow|yesterday)\b/gi),
    ...value.matchAll(/\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi),
  ];
  return anchors.length;
}

/** Two independent date anchors are not silently collapsed to whichever parser runs first. */
export function hasConflictingDateAnchors(text: string): boolean {
  return countDateAnchors(text) >= 2;
}

const KO_RANGE_RE =
  /(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*부터\s*(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*까지/;

function toMinutes(period: string | undefined, hour: number, minute: number): number | null {
  if (minute < 0 || minute > 59) return null;
  if (period) {
    if (hour < 1 || hour > 12) return null;
    let h = hour;
    if (period === "오후" && h < 12) h += 12;
    if (period === "오전" && h === 12) h = 0;
    return h * 60 + minute;
  }
  if (hour < 0 || hour > 23) return null;
  return hour * 60 + minute;
}

/**
 * Current schedule model has no explicit overnight rollover. A canonical range
 * that resolves end <= start therefore needs clarification instead of a made-up
 * one-hour fallback.
 */
export function hasUnsafeCanonicalClockRange(text: string): boolean {
  const match = text.trim().match(KO_RANGE_RE);
  if (!match) return false;

  const startPeriod = match[1];
  const startHour = Number(match[2]);
  const startMinute = match[3] === "반" ? 30 : match[4] ? Number(match[4]) : 0;
  const endPeriod = match[5] ?? startPeriod;
  const endHour = Number(match[6]);
  const endMinute = match[7] === "반" ? 30 : match[8] ? Number(match[8]) : 0;

  const start = toMinutes(startPeriod, startHour, startMinute);
  const end = toMinutes(endPeriod, endHour, endMinute);
  if (start === null || end === null) return true;

  if (!startPeriod && startHour >= 1 && startHour <= 12) return false;
  return end <= start;
}

/** Meta-language about remembering/saving is not a new schedule command. */
export function hasScheduleMetaNegation(text: string): boolean {
  const value = text.trim();
  return (
    /(?:였나|였지|기억이\s*안\s*나|기억\s*안\s*나)/.test(value) ||
    /(?:저장|등록|일정으로\s*추가)(?:하|해|하지)?\s*(?:마|말(?:아|라고)?)/.test(value) ||
    /아니고\s*(?:그냥\s*)?메모/.test(value) ||
    /\b(?:do\s+not|don't)\s+(?:schedule|add|save)\b/i.test(value)
  );
}

/** Fail closed on pasted line breaks or look-alike colon punctuation around a clock. */
export function hasMalformedScheduleClock(text: string): boolean {
  const value = text.trim();
  if (/\r|\n/.test(text)) return true;
  if (/\d\s*：\s*\d/.test(value)) return true;
  return false;
}

/**
 * A clock plus multiple Korean action clauses has no safe attachment model yet.
 * Keep it raw rather than assigning the first clock to the whole sentence.
 */
export function hasAmbiguousMultiClauseSchedule(text: string): boolean {
  const value = text.trim();
  const hasClock =
    /(?:오전|오후)\s*\d{1,2}\s*시(?!\s*간)|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(value);
  if (!hasClock) return false;
  return /(?:보고|만나고|끝나고)\s+\S+/.test(value);
}

export function adversarialScheduleReason(text: string): AdversarialScheduleReason | null {
  if (hasInvalidClockExpression(text)) return "invalid_clock";
  if (hasDurationClockCollision(text)) return "duration_clock_collision";
  if (hasConflictingDateAnchors(text)) return "conflicting_dates";
  if (hasUnsafeCanonicalClockRange(text)) return "unsafe_clock_range";
  if (hasScheduleMetaNegation(text)) return "semantic_meta";
  if (hasMalformedScheduleClock(text)) return "malformed_clock";
  if (hasAmbiguousMultiClauseSchedule(text)) return "multi_clause";
  return null;
}
