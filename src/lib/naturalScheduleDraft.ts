import type { ScheduleConfirmOptions } from "@/components/ScheduleChoiceFlow";
import { detectDate } from "@/lib/dateDetect";
import {
  defaultEndFromStart,
  endOfDay,
  startOfDay,
} from "@/lib/scheduleChoices";
import type { InboxItem } from "@/lib/store";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { hasAmbiguousBareMeridiem } from "@/lib/nlScheduleSafety";
import { normalizeKoreanClockWordsForParsing } from "@/lib/nlKoreanTemporalNormalization";
import {
  hasApproximateTimeExpression,
  hasDeadlineExpression,
  hasExpandedRepeatIntent,
  hasMixedKoreanMeridiemColon,
  hasPastDateReference,
  hasUnsupportedColonClockRange,
  shouldKeepScheduleSemanticsQuiet,
} from "@/lib/nlSemanticSafety";

// Exact/resolvable clocks only. Standalone dayparts such as "오전", "오후",
// "morning", or "afternoon" deliberately do not count as a clock.
const EXPLICIT_TIME_RE =
  /(?:(?:오전|오후)\s*\d{1,2}\s*시(?!\s*간)(?:\s*반|(?:\s*\d{1,2}\s*분))?|(?:\d+|한|두|세|네)\s*(?:분|시간)\s*(?:뒤|후)|반\s*시간\s*(?:뒤|후)|\d{1,2}\s*시(?!\s*간)(?:\s*반|(?:\s*\d{1,2}\s*분))?|\bin\s+(?:\d+|an?|one|two|three|four|half(?:\s+an?)?)\s*(?:minutes?|mins?|hours?|hrs?)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b)/i;

const AFTER_WORK_RE = /퇴근\s*(?:후|하고|하고서|뒤)|\bafter\s+work\b/i;

const RESOLVED_CLOCK_BESIDE_AFTER_WORK_RE =
  /(?:(?:오전|오후)\s*\d{1,2}\s*시|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|(?:[01]?\d|2[0-3]):[0-5]\d|(?:1[3-9]|2[0-3])\s*시)/i;

const KO_CLOCK_RANGE_RE =
  /(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*부터\s*(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*까지/;

const REPEAT_INTENT_RE =
  /(?:매일|매일마다|매주|매주마다|매월|매달|매년|해마다|every\s+(?:day|week|month|year)|daily|weekly|monthly|yearly|annually)/i;

const KO_WEEKDAY: Record<string, number> = {
  일: 0,
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6,
};

const EN_WEEKDAY: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

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

export type NaturalScheduleDraft = {
  text: string;
  start: Date;
  end: Date;
  options: ScheduleConfirmOptions;
  reminderExplicit: boolean;
};

function rangeStartIsResolved(text: string): boolean {
  const match = text.match(KO_CLOCK_RANGE_RE);
  if (!match) return false;
  const startPeriod = match[1];
  const startHour = Number(match[2]);
  return Boolean(startPeriod) || (startHour >= 13 && startHour <= 23);
}

export function hasNaturalScheduleTime(text: string): boolean {
  // Parsing-only: spoken Korean clocks share the Arabic-digit safety contract.
  const trimmed = normalizeKoreanClockWordsForParsing(text.trim());
  if (!EXPLICIT_TIME_RE.test(trimmed)) return false;

  // A single from–to range can inherit the start meridiem on its end clock:
  // "오후 5시부터 6시까지" = 17:00–18:00. A bare "5시부터 6시까지"
  // still needs AM/PM clarification.
  if (KO_CLOCK_RANGE_RE.test(trimmed)) {
    return rangeStartIsResolved(trimmed);
  }

  // Bare 1–12 o'clock without meridiem is ambiguous, not a resolved clock.
  if (hasAmbiguousBareMeridiem(trimmed)) return false;
  // After-work alone is not an absolute time without a known commute end.
  if (AFTER_WORK_RE.test(trimmed)) {
    const withoutAfterWork = trimmed
      .replace(/퇴근\s*(?:후|하고|하고서|뒤)/g, " ")
      .replace(/\bafter\s+work\b/gi, " ");
    if (!RESOLVED_CLOCK_BESIDE_AFTER_WORK_RE.test(withoutAfterWork)) {
      return false;
    }
  }
  return true;
}

/** Recurrence is deliberately not collapsed into a one-off schedule. */
export function hasNaturalRepeatIntent(text: string): boolean {
  return REPEAT_INTENT_RE.test(text.trim());
}

function startOfNextWeek(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday + 7);
  return d;
}

function nextWeekWeekday(text: string, now: Date): Date | null {
  const hasNextWeek = /다음\s*주/i.test(text) || /\bnext\s+week\b/i.test(text);
  const directNextWeekday = text.match(
    /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  const ko = text.match(/(일|월|화|수|목|금|토)요일/);
  const en = text.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );

  if (!hasNextWeek && !directNextWeekday) return null;

  const targetDay = ko
    ? KO_WEEKDAY[ko[1]]
    : EN_WEEKDAY[(directNextWeekday?.[1] ?? en?.[1] ?? "").toLowerCase()];
  if (targetDay === undefined) return null;

  const monday = startOfNextWeek(now);
  const mondayBasedOffset = targetDay === 0 ? 6 : targetDay - 1;
  monday.setDate(monday.getDate() + mondayBasedOffset);
  return monday;
}

function numericValue(raw: string, words: Record<string, number>): number | null {
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return words[raw.toLowerCase()] ?? null;
}

/**
 * Common conversational offsets are cheap and deterministic enough to resolve
 * locally. This keeps phrases such as “30분 뒤 출발” and “in 2 hours call mom”
 * on the reliable path without introducing a model/API dependency.
 */
function relativeOffsetStart(text: string, now: Date): Date | null {
  // Larger unsupported compounds must not leak a smaller supported substring.
  if (
    /(?:\d+|한|두|세|네)\s*시간\s+\d+\s*분\s*(?:뒤|후)/.test(text) ||
    /(?:\d+|한|두|세|네)\s*시간\s*반\s*(?:뒤|후)/.test(text) ||
    /\d+\.\d+\s*(?:시간|분|일)/.test(text) ||
    /[+-]\s*\d+(?:\.\d+)?\s*(?:시간|분|일)\s*(?:뒤|후)/.test(text)
  ) {
    return null;
  }

  const koHalf = text.match(/반\s*시간\s*(?:뒤|후)/);
  if (koHalf) return new Date(now.getTime() + 30 * 60_000);

  const ko = text.match(/(\d+|한|두|세|네)\s*(분|시간|일)\s*(?:뒤|후)/);
  if (ko) {
    const amount = numericValue(ko[1], KO_SMALL_NUMBER);
    if (!amount) return null;
    const unitMs =
      ko[2] === "분"
        ? 60_000
        : ko[2] === "시간"
          ? 60 * 60_000
          : 24 * 60 * 60_000;
    return new Date(now.getTime() + amount * unitMs);
  }

  const enHalf = text.match(/\bin\s+half(?:\s+an?)?\s+hour\b/i);
  if (enHalf) return new Date(now.getTime() + 30 * 60_000);

  const en = text.match(
    /\bin\s+(\d+|an?|one|two|three|four)\s*(minutes?|mins?|hours?|hrs?|days?)\b/i,
  );
  if (!en) return null;
  const amount = numericValue(en[1], EN_SMALL_NUMBER);
  if (!amount) return null;
  const unit = en[2].toLowerCase();
  const unitMs = unit.startsWith("min")
    ? 60_000
    : unit.startsWith("h")
      ? 60 * 60_000
      : 24 * 60 * 60_000;
  return new Date(now.getTime() + amount * unitMs);
}

function applyNaturalTime(target: Date, text: string, detected: Date | null): Date {
  const d = new Date(target);

  if (detected && hasNaturalScheduleTime(text)) {
    d.setHours(detected.getHours(), detected.getMinutes(), 0, 0);
    return d;
  }

  // No exact clock was supplied. Keep the date anchor neutral; callers promote
  // this to an all-day item instead of showing a made-up 09:00/12:00/18:00.
  d.setHours(0, 0, 0, 0);
  return d;
}

export function resolveNaturalScheduleStart(text: string, now = new Date()): Date | null {
  const normalized = normalizeKoreanClockWordsForParsing(text.trim());
  const relative = relativeOffsetStart(normalized, now);
  if (relative) return relative;

  const detected = detectDate(normalized, now);
  const anchored = nextWeekWeekday(normalized, now);

  if (anchored) return applyNaturalTime(anchored, normalized, detected?.start ?? null);
  if (!detected) return null;

  const resolved = new Date(detected.start);
  if (!hasNaturalScheduleTime(normalized)) resolved.setHours(0, 0, 0, 0);
  return resolved;
}

function resolveKoreanRangeEnd(text: string, start: Date): Date | null {
  const match = text.match(KO_CLOCK_RANGE_RE);
  if (!match) return null;

  const startPeriod = match[1] as "오전" | "오후" | undefined;
  const endPeriod = (match[5] as "오전" | "오후" | undefined) ?? startPeriod;
  let endHour = Number(match[6]);
  const endMinute = match[7] === "반" ? 30 : match[8] ? Number(match[8]) : 0;

  if (!endPeriod && endHour >= 1 && endHour <= 12) return null;
  if (endPeriod === "오후" && endHour < 12) endHour += 12;
  if (endPeriod === "오전" && endHour === 12) endHour = 0;
  if (endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59) return null;

  const end = new Date(start);
  end.setHours(endHour, endMinute, 0, 0);
  if (end.getTime() <= start.getTime()) return null;
  return end;
}

export function inferNaturalReminderMinutes(
  text: string,
  hasSpecificTime: boolean,
): { minutes: number | null; explicit: boolean } {
  const value = text.trim();

  if (/(?:알림\s*(?:끄기|없음)|알려\s*주지\s*마|reminder\s*off|do\s*not\s*remind)/i.test(value)) {
    return { minutes: null, explicit: true };
  }
  if (/(?:전날|하루\s*전|1\s*일\s*전|day\s+before|1\s*day\s+before)/i.test(value)) {
    return { minutes: 24 * 60, explicit: true };
  }
  if (/(?:1\s*시간\s*전|한\s*시간\s*전|1\s*hour\s+before|an\s+hour\s+before)/i.test(value)) {
    return { minutes: 60, explicit: true };
  }
  if (/(?:30\s*분\s*전|30\s*(?:m|min|minutes?)\s+before)/i.test(value)) {
    return { minutes: 30, explicit: true };
  }
  if (/(?:10\s*분\s*전|10\s*(?:m|min|minutes?)\s+before)/i.test(value)) {
    return { minutes: 10, explicit: true };
  }
  if (/(?:5\s*분\s*전|5\s*(?:m|min|minutes?)\s+before)/i.test(value)) {
    return { minutes: 5, explicit: true };
  }
  if (/(?:그때\s*알려|시작할\s*때\s*알려|시간\s*되면\s*알려|remind\s+me\s+then|at\s+the\s+start)/i.test(value)) {
    return { minutes: 0, explicit: true };
  }
  if (/(?:알려\s*줘|알려줘|알림\s*(?:해|줘)|리마인드|remind\s+me|notify\s+me)/i.test(value)) {
    return { minutes: 0, explicit: true };
  }

  // Itjima is a memory service: a genuinely understood timed commitment gets
  // an at-start reminder. A fallback schedule with no parsed date must not
  // silently invent an alarm merely because the UI supplied a default hour.
  return { minutes: hasSpecificTime ? 0 : null, explicit: false };
}

/** Korean clock token: never match 시 inside 시간 or title words such as 7시리즈. */
const KO_CLOCK_TOKEN_RE =
  /(?:오전|오후)\s*\d{1,2}\s*시(?:\s*반|(?:\s*\d{1,2}\s*분))?(?!\s*(?:리즈|방향))|\d{1,2}\s*시(?!\s*간)(?:\s*반|(?:\s*\d{1,2}\s*분))?(?!\s*(?:리즈|방향))/;

const KO_CLOCK_WITH_PARTICLE_RE =
  /(?:(?:오전|오후)\s*\d{1,2}\s*시(?:\s*반|(?:\s*\d{1,2}\s*분))?|\d{1,2}\s*시(?!\s*간)(?:\s*반|(?:\s*\d{1,2}\s*분))?)(?!\s*(?:리즈|방향))(?:에)?/g;

const KO_SUPPORTED_RELATIVE_SRC =
  "(?:\\d+|한|두|세|네)\\s*분\\s*(?:뒤|후)(?:에)?|(?:\\d+|한|두|세|네)\\s*시간\\s*(?:뒤|후)(?:에)?|반\\s*시간\\s*(?:뒤|후)(?:에)?";

const EN_SUPPORTED_RELATIVE_SRC =
  "\\bin\\s+(?:\\d+|an?|one|two|three|four)\\s*(?:minutes?|mins?|hours?|hrs?)\\b";

const EN_CLOCK_SRC = "\\b\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)\\b";

function hasSupportedTitleTemporal(text: string): boolean {
  if (KO_CLOCK_RANGE_RE.test(text)) return true;
  if (KO_CLOCK_TOKEN_RE.test(text)) return true;
  if (new RegExp(EN_CLOCK_SRC, "i").test(text)) return true;
  if (new RegExp(KO_SUPPORTED_RELATIVE_SRC).test(text)) return true;
  if (new RegExp(EN_SUPPORTED_RELATIVE_SRC, "i").test(text)) return true;
  return false;
}

/**
 * Unsupported / semantic-critical language must stay verbatim — partial deletes
 * invent a title that no longer matches what the user said.
 */
function shouldPreserveRawScheduleTitle(text: string): boolean {
  const value = text.trim();
  if (!value) return true;

  if (shouldKeepScheduleSemanticsQuiet(value)) return true;
  if (hasApproximateTimeExpression(value)) return true;
  if (hasDeadlineExpression(value)) return true;
  if (hasNaturalRepeatIntent(value) || hasExpandedRepeatIntent(value)) return true;
  if (hasMixedKoreanMeridiemColon(value)) return true;
  if (hasUnsupportedColonClockRange(value)) return true;
  if (hasPastDateReference(value)) return true;

  // Week-after-next and half-hour relatives are not owned by metadata yet.
  if (/다다음\s*주|week\s+after\s+next/i.test(value)) return true;
  if (/시간\s*반/.test(value)) return true;

  // Unsupported range syntax (~ / bare hyphen clocks).
  if (/~/.test(value)) return true;
  if (/\d{1,2}\s*시(?!\s*간)\s*-\s*\d{1,2}\s*시(?!\s*간)/.test(value)) return true;

  // Vague week hedges not covered by approximate-clock guard.
  if (/(?:주\s*쯤|week\s+or\s+so|\bor\s+so\b)/i.test(value)) return true;

  // Weekend without a supported cleanable clock stays with weekend ambiguity UX.
  if (/(?:주말|\bweekend\b)/i.test(value) && !hasSupportedTitleTemporal(value)) {
    return true;
  }

  // Standalone dayparts / date-only lines have no metadata-owned exact span.
  if (!hasSupportedTitleTemporal(value)) return true;

  return false;
}

function stripSupportedTemporalSpans(text: string): string {
  let title = text;

  title = title
    .replace(
      /(?:그리고\s*)?(?:전날|하루\s*전|1\s*일\s*전|1\s*시간\s*전|한\s*시간\s*전|30\s*분\s*전|10\s*분\s*전|5\s*분\s*전|그때|시작할\s*때)?\s*(?:에도?\s*)?(?:알려\s*줘|알려줘|알림\s*(?:해|줘)|리마인드(?:\s*해줘)?)/gi,
      " ",
    )
    .replace(
      /\b(?:remind|notify)\s+me(?:\s+(?:the\s+day\s+before|(?:1\s*hour|30\s*minutes?|10\s*minutes?|5\s*minutes?)\s+before|then))?\b/gi,
      " ",
    );

  // Canonical from–to ranges are one atomic span (includes …까지).
  title = title.replace(new RegExp(KO_CLOCK_RANGE_RE.source, "g"), " ");

  // Supported relatives (minutes / Hangul-number hours). Never strip `N시간 반`.
  title = title.replace(new RegExp(KO_SUPPORTED_RELATIVE_SRC, "g"), " ");
  title = title.replace(new RegExp(EN_SUPPORTED_RELATIVE_SRC, "gi"), " ");
  title = title.replace(/\bin\s+half(?:\s+an?)?\s+hour\b/gi, " ");

  // English "at 3pm" before bare clocks so the connector leaves with the clock.
  title = title.replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, " ");
  title = title.replace(new RegExp(EN_CLOCK_SRC, "gi"), " ");

  // Korean clocks including attached scheduling particle (에). Embedded title
  // words and spatial phrases such as `7시리즈` / `3시 방향` are not owned.
  title = title.replace(KO_CLOCK_WITH_PARTICLE_RE, " ");

  // Full / absolute dates.
  title = title.replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g, " ");
  title = title.replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, " ");

  // Week + weekday anchors (never swallow 주말).
  title = title.replace(
    /(?:다음|이번)\s*주(?!\s*말)(?:\s*(?:일|월|화|수|목|금|토)요일)?/g,
    " ",
  );
  title = title.replace(/이번\s*(?:일|월|화|수|목|금|토)요일/g, " ");
  title = title.replace(/(?:일|월|화|수|목|금|토)요일/g, " ");
  title = title.replace(
    /\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
    " ",
  );
  title = title.replace(/\b(?:next|this)\s+week(?!\s*end\b)\b/gi, " ");

  // Relative day words must be standalone date phrases. Do not strip semantic
  // title text such as `내일이라는 소설` merely because it starts with 내일.
  title = title.replace(
    /(?:오늘|내일|모레|글피)(?:은|는|에|부터|까지)?(?=\s|$|[,.!?])/g,
    " ",
  );
  title = title.replace(/\b(?:today|tomorrow)\b/gi, " ");

  title = title
    .replace(/퇴근\s*(?:후|하고|하고서|뒤)/g, " ")
    .replace(/\bafter\s+work\b/gi, " ")
    // Dangling terminal connectors only — keep semantic "Meet at the clinic".
    .replace(/\b(?:at|on|by)\b(?=\s*(?:[,.!?]|$))/gi, " ")
    .replace(/^(?:에|에서|까지|부터)\s+/g, "")
    .replace(/\s+(?:에|에서|까지|부터)$/g, "")
    .replace(/[,.!?]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return title;
}

/**
 * Display-only: remove metadata-owned temporal spans atomically.
 * Unsupported or semantic-critical language is returned unchanged.
 */
export function cleanScheduleTitle(text: string): string {
  const original = sanitizeScheduleTitleControls(thoughtFirstLine(text));
  // Title cleaning is display-only over a parsing normalization of clocks.
  const normalized = normalizeKoreanClockWordsForParsing(original);
  if (shouldPreserveRawScheduleTitle(normalized)) {
    // Preserve the caller's original surface form for unsupported/unsafe input,
    // but never persist C0 control characters.
    return sanitizeScheduleTitleControls(original.trim());
  }

  const title = stripSupportedTemporalSpans(normalized);
  return sanitizeScheduleTitleControls(title || original.trim());
}

/** Strip C0 controls / DEL; keep ordinary whitespace collapsed. */
function sanitizeScheduleTitleControls(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\t\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildNaturalScheduleDraft(
  item: InboxItem,
  now = new Date(),
): NaturalScheduleDraft {
  const startResolved = resolveNaturalScheduleStart(item.text, now);
  const explicitTime = hasNaturalScheduleTime(item.text);
  const dateOnly = Boolean(startResolved) && !explicitTime;
  const start = startResolved
    ? dateOnly
      ? startOfDay(startResolved)
      : startResolved
    : (() => {
        const d = new Date(now);
        d.setMinutes(0, 0, 0);
        if (d.getHours() < 9) d.setHours(9, 0, 0, 0);
        else if (d.getHours() >= 18) {
          d.setDate(d.getDate() + 1);
          d.setHours(9, 0, 0, 0);
        } else d.setHours(d.getHours() + 1, 0, 0, 0);
        return d;
      })();
  const rangeEnd = !dateOnly ? resolveKoreanRangeEnd(item.text, start) : null;
  const end = dateOnly ? endOfDay(start) : rangeEnd ?? defaultEndFromStart(start);
  const reminder = inferNaturalReminderMinutes(
    item.text,
    Boolean(startResolved) && explicitTime,
  );

  return {
    text: cleanScheduleTitle(item.text),
    start,
    end,
    reminderExplicit: reminder.explicit,
    options: {
      reminderMinutes: reminder.minutes,
      allDay: dateOnly,
      startAllDay: dateOnly,
      endAllDay: dateOnly,
      repeat: null,
    },
  };
}

export function formatCommitmentDate(start: Date, lang: "ko" | "en"): string {
  return start.toLocaleDateString(lang === "en" ? "en-US" : "ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function formatCommitmentTime(
  start: Date,
  allDay: boolean,
  lang: "ko" | "en",
): string {
  if (allDay) return lang === "en" ? "All day" : "하루 종일";
  return start.toLocaleTimeString(lang === "en" ? "en-US" : "ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatCommitmentReminder(
  minutes: number | null,
  lang: "ko" | "en",
): string {
  if (minutes === null) return lang === "en" ? "Off" : "없음";
  if (minutes === 0) return lang === "en" ? "At start" : "시작 시간";
  if (minutes === 5) return lang === "en" ? "5 min before" : "5분 전";
  if (minutes === 10) return lang === "en" ? "10 min before" : "10분 전";
  if (minutes === 30) return lang === "en" ? "30 min before" : "30분 전";
  if (minutes === 60) return lang === "en" ? "1 hour before" : "1시간 전";
  if (minutes === 24 * 60) return lang === "en" ? "1 day before" : "전날";
  return lang === "en" ? `${minutes} min before` : `${minutes}분 전`;
}

/** Compact when-label for saved-result feedback: `내일 · 오후 3:30`. */
export function formatCaptureWhenLabel(
  start: Date,
  allDay: boolean,
  lang: "ko" | "en",
  now = new Date(),
): string {
  const startDay = startOfDay(start).getTime();
  const today = startOfDay(now).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  let dayLabel: string;
  if (startDay === today) {
    dayLabel = lang === "en" ? "Today" : "오늘";
  } else if (startDay === today + dayMs) {
    dayLabel = lang === "en" ? "Tomorrow" : "내일";
  } else {
    dayLabel = formatCommitmentDate(start, lang);
  }
  const timeLabel = formatCommitmentTime(start, allDay, lang);
  return `${dayLabel} · ${timeLabel}`;
}
