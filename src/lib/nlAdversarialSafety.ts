import { hasInvalidCalendarDateExpression } from "@/lib/nlCalendarValidity";

export type AdversarialScheduleReason =
  | "invalid_clock"
  | "duration_clock_collision"
  | "conflicting_dates"
  | "conflicting_meridiem"
  | "unsafe_clock_range"
  | "semantic_meta"
  | "malformed_clock"
  | "multi_clause"
  | "invalid_calendar"
  | "unsupported_compound_relative"
  | "non_exact_clock_semantics"
  | "unsupported_date_residue";

const KO_MERIDIEM_CLOCK_RE =
  /(오전|오후)\s*(\d{1,2})\s*시(?!\s*간)(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/g;
/** Bare Korean clocks including optional minute/half — minutes must be validated. */
const KO_BARE_CLOCK_RE =
  /(?:^|[^0-9가-힣])([0-9]{1,2})\s*시(?!\s*간)(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/g;
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
    const minute = match[2] === "반" ? 30 : match[3] ? Number(match[3]) : 0;
    if (hour < 0 || hour > 23) return true;
    if (minute < 0 || minute > 59) return true;
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
  return /(?:오전|오후)\s*(?:\d+|한|두|세|네)\s*시간(?!\s*(?:뒤|후))/.test(
    text.trim(),
  );
}

const KO_WEEKDAY_INDEX: Record<string, number> = {
  일: 0,
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6,
};

const EN_WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

type AbsoluteDateAnchor = { year: number; month: number; day: number };

function extractAbsoluteDateAnchors(text: string): AbsoluteDateAnchor[] {
  const out: AbsoluteDateAnchor[] = [];
  const seen = new Set<string>();
  const push = (year: number, month: number, day: number) => {
    const key = `${year}-${month}-${day}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ year, month, day });
  };

  for (const match of text.matchAll(
    /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g,
  )) {
    push(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  let rest = text.replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g, " ");
  for (const match of rest.matchAll(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)) {
    // Year filled by caller when checking weekday contradiction against `now`.
    push(0, Number(match[1]), Number(match[2]));
  }
  return out;
}

function extractWeekdayIndexes(text: string): number[] {
  const out: number[] = [];
  for (const match of text.matchAll(/([일월화수목금토])요일/g)) {
    const idx = KO_WEEKDAY_INDEX[match[1]];
    if (idx !== undefined) out.push(idx);
  }
  for (const match of text.matchAll(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
  )) {
    const idx = EN_WEEKDAY_INDEX[match[1].toLowerCase()];
    if (idx !== undefined) out.push(idx);
  }
  return out;
}

function weekdayContradictsAbsolute(text: string, now = new Date()): boolean {
  const weekdays = extractWeekdayIndexes(text);
  if (weekdays.length === 0) return false;
  const absolutes = extractAbsoluteDateAnchors(text);
  if (absolutes.length === 0) return false;

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  for (const abs of absolutes) {
    let year = abs.year;
    if (!year) {
      year = now.getFullYear();
      const probe = new Date(year, abs.month - 1, abs.day);
      // Match production month-day rollover: past calendar days advance one year.
      if (probe.getTime() < startOfToday) year += 1;
    }
    const resolved = new Date(year, abs.month - 1, abs.day);
    for (const weekday of weekdays) {
      if (resolved.getDay() !== weekday) return true;
    }
  }
  return false;
}

/**
 * Two independent date anchors are not silently collapsed to whichever parser
 * runs first. Weekday + absolute must also agree when both are stated.
 */
export function hasConflictingDateAnchors(
  text: string,
  now = new Date(),
): boolean {
  const value = text.trim();
  if (!value) return false;
  if (weekdayContradictsAbsolute(value, now)) return true;

  const absolutes = extractAbsoluteDateAnchors(value);
  const relatives = [
    ...value.matchAll(/오늘|내일|모레|글피/g),
    ...value.matchAll(/\b(?:today|tomorrow|yesterday)\b/gi),
  ];
  const weekdays = extractWeekdayIndexes(value);

  if (absolutes.length >= 2) return true;
  if (relatives.length >= 2) return true;
  if (weekdays.length >= 2) return true;
  if (absolutes.length >= 1 && relatives.length >= 1) return true;

  // Weekday + absolute that agree count as one unit (contradiction handled above).
  if (absolutes.length === 0 && relatives.length + weekdays.length >= 2) {
    return true;
  }
  return false;
}

const KO_RANGE_RE =
  /(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*부터\s*(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*까지/;

/**
 * Opposite meridiem words around a single clock are contradictory, not a cue to
 * pick whichever token is closest. A valid from-to range may legitimately use
 * both (e.g. 오전 11시부터 오후 1시까지), so remove owned ranges first.
 */
export function hasConflictingKoreanMeridiem(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  const withoutRanges = value.replace(new RegExp(KO_RANGE_RE.source, "g"), " ");
  return /오전/.test(withoutRanges) && /오후/.test(withoutRanges);
}

function toMinutes(
  period: string | undefined,
  hour: number,
  minute: number,
): number | null {
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
    /(?:저장|등록|일정으로\s*추가)(?:하|해|하지)?\s*(?:마|말(?:아|라고)?)/.test(
      value,
    ) ||
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
    /(?:오전|오후)\s*\d{1,2}\s*시(?!\s*간)|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(
      value,
    );
  if (!hasClock) return false;
  return /(?:보고|만나고|끝나고)\s+\S+/.test(value);
}

/**
 * A larger unsupported relative expression must not leak a smaller supported
 * substring (e.g. `1시간 30분 뒤` → `30분 뒤`, `1.5시간` → `5시간`).
 */
export function hasUnsupportedCompoundRelative(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (
    /(?:\d+|한|두|세|네)\s*시간\s+\d+\s*분\s*(?:뒤|후)/.test(value)
  ) {
    return true;
  }
  if (/(?:\d+|한|두|세|네)\s*시간\s*반\s*(?:뒤|후)/.test(value)) {
    return true;
  }
  if (/\d+\.\d+\s*(?:시간|분|일)/.test(value)) return true;
  if (/\d+\.\d+\s*(?:hours?|hrs?|minutes?|mins?|days?)\b/i.test(value)) {
    return true;
  }
  if (/[+-]\s*\d+(?:\.\d+)?\s*(?:시간|분|일)\s*(?:뒤|후)/.test(value)) {
    return true;
  }
  if (
    /[+-]\s*\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|days?)\b/i.test(value)
  ) {
    return true;
  }
  if (/\bin\s+\d+\s+hours?\s+(?:and\s+)?\d+\s+minutes?\b/i.test(value)) {
    return true;
  }
  return false;
}

/**
 * Exact clock tokens do not grant exact auto-commit when the utterance means
 * before / after / around / sequencing / conditional timing.
 */
export function hasNonExactClockSemantics(text: string): boolean {
  const value = text.trim();
  if (!value) return false;

  if (
    /(?:오전|오후)?\s*\d{1,2}\s*시(?:\s*(?:반|\d{1,2}\s*분))?\s*(?:전에|이전에|이후에|후에|전후로|지나서)/.test(
      value,
    )
  ) {
    return true;
  }
  if (
    /(?:오전|오후)?\s*\d{1,2}\s*시(?:\s*(?:반|\d{1,2}\s*분))?\s*.{0,12}(?:끝나면|끝난\s*뒤|갔다가)/.test(
      value,
    )
  ) {
    return true;
  }
  if (
    /\b(?:before|after)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(value)
  ) {
    return true;
  }
  if (
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\s+(?:before|after)\b/i.test(value)
  ) {
    return true;
  }
  if (
    /\b(?:after|before)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(value)
  ) {
    return true;
  }
  return false;
}

/**
 * Unsupported colloquial/typo date tokens must not disappear while a clock is
 * reinterpreted as today.
 */
export function hasUnsupportedDateResidue(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  const residue =
    /(?:(?:^|[^가-힣])낼(?![가-힣])|[월화수목금토일]욜|담주|\btomorow\b|\btmrw\b|\btmr\b)/i.test(
      value,
    );
  if (!residue) return false;
  const hasClock =
    /(?:오전|오후)?\s*\d{1,2}\s*시(?!\s*간)|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b/i.test(
      value,
    );
  return hasClock;
}

export function adversarialScheduleReason(
  text: string,
  now = new Date(),
): AdversarialScheduleReason | null {
  if (hasInvalidClockExpression(text)) return "invalid_clock";
  if (hasInvalidCalendarDateExpression(text)) return "invalid_calendar";
  if (hasDurationClockCollision(text)) return "duration_clock_collision";
  if (hasUnsupportedCompoundRelative(text)) {
    return "unsupported_compound_relative";
  }
  if (hasConflictingKoreanMeridiem(text)) return "conflicting_meridiem";
  if (hasNonExactClockSemantics(text)) return "non_exact_clock_semantics";
  if (hasUnsupportedDateResidue(text)) return "unsupported_date_residue";
  if (hasConflictingDateAnchors(text, now)) return "conflicting_dates";
  if (hasUnsafeCanonicalClockRange(text)) return "unsafe_clock_range";
  if (hasScheduleMetaNegation(text)) return "semantic_meta";
  if (hasMalformedScheduleClock(text)) return "malformed_clock";
  if (hasAmbiguousMultiClauseSchedule(text)) return "multi_clause";
  return null;
}
