import {
  hasApproximateTimeExpression,
  hasBroadUnresolvedDatePeriod,
  hasDeadlineExpression,
  hasExpandedRepeatIntent,
  hasMixedKoreanMeridiemColon,
  hasPastDateReference,
  hasPastTimeOnlyClock,
  hasUnsupportedColonClockRange,
  hasUnsupportedDateRange,
} from "@/lib/nlSemanticSafety";
import { hasNaturalRepeatIntent } from "@/lib/naturalScheduleDraft";

export type TemporalDateKind =
  | "today"
  | "tomorrow"
  | "day_after_tomorrow"
  | "three_days_later"
  | "yesterday"
  | "day_before_yesterday"
  | "last_week"
  | "last_month"
  | "last_year"
  | "weekday"
  | "month_day"
  | "full_date"
  | "this_week"
  | "next_week"
  | "weekend"
  | "next_month_early"
  | "next_month_day";

export type TemporalDate = {
  kind: TemporalDateKind;
  raw: string;
};

export type TemporalDaypart =
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "dawn"
  | "lunch"
  | "noon"
  | "midnight";

export type TemporalExactClock = {
  hour24: number;
  minute: number;
  raw: string;
};

export type TemporalBareClock = {
  hour: number;
  minute: number;
  raw: string;
};

export type TemporalRelativeOffset = {
  amount: number;
  unit: "minute" | "hour" | "day";
  raw: string;
};

export type TemporalRangeClock =
  | { kind: "exact"; hour24: number; minute: number; raw: string }
  | { kind: "bare"; hour: number; minute: number; raw: string };

export type TemporalRange = {
  raw: string;
  supportedSyntax: boolean;
  resolved: boolean;
  start: TemporalRangeClock | null;
  end: TemporalRangeClock | null;
  inheritedEndMeridiem: boolean;
};

export type TemporalDeadline = {
  raw: string;
};

export type TemporalRecurrence = {
  raw: string;
  kind: "daily" | "weekly" | "weekday" | "interval" | "other";
};

export type TemporalAmbiguity =
  | "missing_meridiem"
  | "broad_date"
  | "weekend_day"
  | "approximate_time"
  | "unsupported_range"
  | "unsupported_relative"
  | "mixed_meridiem_colon"
  | "past_reference";

export type TemporalPrecision =
  | "none"
  | "date"
  | "daypart"
  | "exact_clock"
  | "relative_offset"
  | "range"
  | "deadline"
  | "recurrence"
  | "ambiguous";

export type NlTemporalModel = {
  rawText: string;
  date: TemporalDate | null;
  daypart: TemporalDaypart | null;
  exactClock: TemporalExactClock | null;
  bareClock: TemporalBareClock | null;
  relativeOffset: TemporalRelativeOffset | null;
  range: TemporalRange | null;
  deadline: TemporalDeadline | null;
  recurrence: TemporalRecurrence | null;
  ambiguities: TemporalAmbiguity[];
  precision: TemporalPrecision;
};

const KO_RANGE_RE =
  /(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*부터\s*(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*까지/;

const KO_UNSUPPORTED_DASH_RANGE_RE =
  /(?:(?:오전|오후)\s*)?\d{1,2}\s*시(?!\s*간)(?:\s*반|(?:\s*\d{1,2}\s*분))?\s*[-~]\s*(?:(?:오전|오후)\s*)?\d{1,2}\s*시(?!\s*간)(?:\s*반|(?:\s*\d{1,2}\s*분))?/;

const KO_SMALL_NUMBER: Record<string, number> = {
  한: 1,
  두: 2,
  세: 3,
  네: 4,
};

const EN_SMALL_NUMBER: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
};

function toHour24(period: "오전" | "오후", hour: number): number {
  if (period === "오후" && hour < 12) return hour + 12;
  if (period === "오전" && hour === 12) return 0;
  return hour;
}

function numericValue(raw: string, words: Record<string, number>): number | null {
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return words[raw.toLowerCase()] ?? null;
}

function parseDate(text: string): TemporalDate | null {
  const full = text.match(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/);
  if (full) return { kind: "full_date", raw: full[0] };

  const nextMonthDay = text.match(/다음\s*달\s*\d{1,2}\s*일/);
  if (nextMonthDay) return { kind: "next_month_day", raw: nextMonthDay[0] };

  const monthDay = text.match(/\d{1,2}\s*월\s*\d{1,2}\s*일|\b\d{1,2}[/-]\d{1,2}\b/);
  if (monthDay) return { kind: "month_day", raw: monthDay[0] };

  const lastWeek = text.match(/지난\s*주|지난주|\blast\s+week\b/i);
  if (lastWeek) return { kind: "last_week", raw: lastWeek[0] };
  const lastMonth = text.match(/지난\s*달|지난달|\blast\s+month\b/i);
  if (lastMonth) return { kind: "last_month", raw: lastMonth[0] };
  const lastYear = text.match(/작년|\blast\s+year\b/i);
  if (lastYear) return { kind: "last_year", raw: lastYear[0] };

  const yesterday = text.match(/어제|\byesterday\b/i);
  if (yesterday) return { kind: "yesterday", raw: yesterday[0] };
  const dayBeforeYesterday = text.match(/그제/);
  if (dayBeforeYesterday) {
    return { kind: "day_before_yesterday", raw: dayBeforeYesterday[0] };
  }

  const koWeekday = text.match(/(?:일|월|화|수|목|금|토)요일/);
  if (koWeekday) return { kind: "weekday", raw: koWeekday[0] };

  const enWeekday = text.match(/\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (enWeekday) return { kind: "weekday", raw: enWeekday[0] };

  if (/다음\s*달\s*초|\bearly\s+next\s+month\b/i.test(text)) {
    const raw = text.match(/다음\s*달\s*초|\bearly\s+next\s+month\b/i)?.[0] ?? "";
    return { kind: "next_month_early", raw };
  }

  if (/주말|\bweekend\b/i.test(text)) {
    const raw = text.match(/주말|\bweekend\b/i)?.[0] ?? "";
    return { kind: "weekend", raw };
  }

  if (/다음\s*주|\bnext\s+week\b/i.test(text)) {
    const raw = text.match(/다음\s*주|\bnext\s+week\b/i)?.[0] ?? "";
    return { kind: "next_week", raw };
  }

  if (/이번\s*주|\bthis\s+week\b/i.test(text)) {
    const raw = text.match(/이번\s*주|\bthis\s+week\b/i)?.[0] ?? "";
    return { kind: "this_week", raw };
  }

  if (/글피/.test(text)) return { kind: "three_days_later", raw: "글피" };
  if (/모레|\bday after tomorrow\b/i.test(text)) {
    const raw = text.match(/모레|\bday after tomorrow\b/i)?.[0] ?? "";
    return { kind: "day_after_tomorrow", raw };
  }
  if (/내일|\btomorrow\b/i.test(text)) {
    const raw = text.match(/내일|\btomorrow\b/i)?.[0] ?? "";
    return { kind: "tomorrow", raw };
  }
  if (/오늘|\btoday\b/i.test(text)) {
    const raw = text.match(/오늘|\btoday\b/i)?.[0] ?? "";
    return { kind: "today", raw };
  }

  return null;
}

function parseDaypart(text: string): TemporalDaypart | null {
  if (/새벽/.test(text)) return "dawn";
  if (/자정|\bmidnight\b/i.test(text)) return "midnight";
  if (/정오|\bnoon\b/i.test(text)) return "noon";
  if (/아침|\bmorning\b/i.test(text)) return "morning";
  if (/점심|\blunch\b/i.test(text)) return "lunch";
  if (/저녁|\bevening\b/i.test(text)) return "evening";
  if (/밤|\btonight\b/i.test(text)) return "night";
  if (/오전/.test(text)) return "morning";
  if (/오후|\bafternoon\b/i.test(text)) return "afternoon";
  return null;
}

function parseRelativeOffset(text: string): TemporalRelativeOffset | null {
  const koHalf = text.match(/반\s*시간\s*(?:뒤|후)/);
  if (koHalf) return { amount: 30, unit: "minute", raw: koHalf[0] };

  const ko = text.match(/(\d+|한|두|세|네)\s*(분|시간|일)\s*(?:뒤|후)/);
  if (ko) {
    const amount = numericValue(ko[1], KO_SMALL_NUMBER);
    if (!amount) return null;
    const unit = ko[2] === "분" ? "minute" : ko[2] === "시간" ? "hour" : "day";
    return { amount, unit, raw: ko[0] };
  }

  const enHalf = text.match(/\bin\s+half(?:\s+an?)?\s+hour\b/i);
  if (enHalf) return { amount: 30, unit: "minute", raw: enHalf[0] };

  const en = text.match(/\bin\s+(\d+|an?|one|two|three|four)\s*(minutes?|mins?|hours?|hrs?|days?)\b/i);
  if (!en) return null;
  const amount = numericValue(en[1], EN_SMALL_NUMBER);
  if (!amount) return null;
  const unitRaw = en[2].toLowerCase();
  const unit = unitRaw.startsWith("min") ? "minute" : unitRaw.startsWith("h") ? "hour" : "day";
  return { amount, unit, raw: en[0] };
}

function parseExactClock(text: string): TemporalExactClock | null {
  const ko = text.match(/(오전|오후)\s*(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/);
  if (ko) {
    const hour = Number(ko[2]);
    const minute = ko[3] === "반" ? 30 : ko[4] ? Number(ko[4]) : 0;
    if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
      return {
        hour24: toHour24(ko[1] as "오전" | "오후", hour),
        minute,
        raw: ko[0],
      };
    }
  }

  const en = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (en) {
    let hour = Number(en[1]);
    const minute = en[2] ? Number(en[2]) : 0;
    const period = en[3].toLowerCase();
    if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
      if (period === "pm" && hour < 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;
      return { hour24: hour, minute, raw: en[0] };
    }
  }

  const h24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b|(?:^|\s)(1[3-9]|2[0-3])\s*시/);
  if (h24) {
    if (h24[1] !== undefined) {
      return { hour24: Number(h24[1]), minute: Number(h24[2]), raw: h24[0].trim() };
    }
    return { hour24: Number(h24[3]), minute: 0, raw: h24[0].trim() };
  }

  return null;
}

function parseBareClock(text: string): TemporalBareClock | null {
  const ko = text.match(/(?:^|[\s(])(\d{1,2})\s*시(?!\s*간)(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/);
  if (ko) {
    const hour = Number(ko[1]);
    const minute = ko[2] === "반" ? 30 : ko[3] ? Number(ko[3]) : 0;
    const prefix = text.slice(Math.max(0, (ko.index ?? 0) - 4), ko.index ?? 0);
    if (hour >= 1 && hour <= 12 && !/(오전|오후)\s*$/.test(prefix)) {
      return { hour, minute, raw: ko[0].trim() };
    }
  }
  return null;
}

function parseRange(text: string): TemporalRange | null {
  const ko = text.match(KO_RANGE_RE);
  if (ko) {
    const startPeriod = ko[1] as "오전" | "오후" | undefined;
    const startHour = Number(ko[2]);
    const startMinute = ko[3] === "반" ? 30 : ko[4] ? Number(ko[4]) : 0;
    const endPeriod = ko[5] as "오전" | "오후" | undefined;
    const endHour = Number(ko[6]);
    const endMinute = ko[7] === "반" ? 30 : ko[8] ? Number(ko[8]) : 0;

    const start: TemporalRangeClock = startPeriod
      ? { kind: "exact", hour24: toHour24(startPeriod, startHour), minute: startMinute, raw: `${startPeriod} ${startHour}시` }
      : startHour >= 13
        ? { kind: "exact", hour24: startHour, minute: startMinute, raw: `${startHour}시` }
        : { kind: "bare", hour: startHour, minute: startMinute, raw: `${startHour}시` };

    const inherited = Boolean(startPeriod && !endPeriod);
    const effectiveEndPeriod = endPeriod ?? startPeriod;
    const end: TemporalRangeClock = effectiveEndPeriod
      ? { kind: "exact", hour24: toHour24(effectiveEndPeriod, endHour), minute: endMinute, raw: `${endPeriod ?? startPeriod} ${endHour}시` }
      : endHour >= 13
        ? { kind: "exact", hour24: endHour, minute: endMinute, raw: `${endHour}시` }
        : { kind: "bare", hour: endHour, minute: endMinute, raw: `${endHour}시` };

    return {
      raw: ko[0],
      supportedSyntax: true,
      resolved: start.kind === "exact" && end.kind === "exact",
      start,
      end,
      inheritedEndMeridiem: inherited,
    };
  }

  if (
    hasUnsupportedColonClockRange(text) ||
    hasUnsupportedDateRange(text) ||
    KO_UNSUPPORTED_DASH_RANGE_RE.test(text) ||
    /\b\d{1,2}:\d{2}\s*[-~]\s*\d{1,2}:\d{2}\b/.test(text)
  ) {
    return {
      raw: text.trim(),
      supportedSyntax: false,
      resolved: false,
      start: null,
      end: null,
      inheritedEndMeridiem: false,
    };
  }

  return null;
}

function parseRecurrence(text: string): TemporalRecurrence | null {
  if (!(hasNaturalRepeatIntent(text) || hasExpandedRepeatIntent(text))) return null;
  const trimmed = text.trim();
  if (/매일|daily|every\s+day/i.test(trimmed)) return { raw: trimmed, kind: "daily" };
  if (/매주|weekly|every\s+week/i.test(trimmed)) return { raw: trimmed, kind: "weekly" };
  if (/(?:일|월|화|수|목|금|토)요일마다/.test(trimmed)) return { raw: trimmed, kind: "weekday" };
  if (/\d+\s*(?:일|주)마다|every\s+\d+\s+(?:days?|weeks?)|격주|every\s+other\s+week/i.test(trimmed)) {
    return { raw: trimmed, kind: "interval" };
  }
  return { raw: trimmed, kind: "other" };
}

function addAmbiguity(list: TemporalAmbiguity[], value: TemporalAmbiguity): void {
  if (!list.includes(value)) list.push(value);
}

export function parseNlTemporalModel(text: string, now = new Date()): NlTemporalModel {
  const rawText = text.trim();
  const date = parseDate(rawText);
  const daypart = parseDaypart(rawText);
  const range = parseRange(rawText);
  const deadline = hasDeadlineExpression(rawText) ? { raw: rawText } : null;
  const recurrence = parseRecurrence(rawText);
  const relativeOffset = parseRelativeOffset(rawText);
  const approximate = hasApproximateTimeExpression(rawText);
  const mixed = hasMixedKoreanMeridiemColon(rawText);
  const unsupportedRelative = /(?:\d+|한|두|세|네)\s*시간\s*반\s*(?:뒤|후)/.test(rawText);

  // Clock mentions stay orthogonal to deadline / recurrence semantics.
  // They are observations, not permission to use the clock as a start time.
  const exactClock = range || relativeOffset || approximate || mixed ? null : parseExactClock(rawText);
  const bareClock = range || relativeOffset || approximate || mixed || exactClock ? null : parseBareClock(rawText);

  const ambiguities: TemporalAmbiguity[] = [];
  if (bareClock) addAmbiguity(ambiguities, "missing_meridiem");
  if (range && range.supportedSyntax && !range.resolved) {
    addAmbiguity(ambiguities, "missing_meridiem");
  } else if (range && !range.supportedSyntax) {
    addAmbiguity(ambiguities, "unsupported_range");
  }
  if (hasBroadUnresolvedDatePeriod(rawText)) addAmbiguity(ambiguities, "broad_date");
  if (date?.kind === "weekend") addAmbiguity(ambiguities, "weekend_day");
  if (approximate) addAmbiguity(ambiguities, "approximate_time");
  if (unsupportedRelative) addAmbiguity(ambiguities, "unsupported_relative");
  if (mixed) addAmbiguity(ambiguities, "mixed_meridiem_colon");
  if (hasPastDateReference(rawText, now) || hasPastTimeOnlyClock(rawText, now)) {
    addAmbiguity(ambiguities, "past_reference");
  }

  let precision: TemporalPrecision = "none";
  if (ambiguities.length > 0) precision = "ambiguous";
  else if (recurrence) precision = "recurrence";
  else if (deadline) precision = "deadline";
  else if (range) precision = "range";
  else if (relativeOffset) precision = "relative_offset";
  else if (exactClock) precision = "exact_clock";
  else if (daypart) precision = "daypart";
  else if (date) precision = "date";

  return {
    rawText,
    date,
    daypart,
    exactClock,
    bareClock,
    relativeOffset,
    range,
    deadline,
    recurrence,
    ambiguities,
    precision,
  };
}
