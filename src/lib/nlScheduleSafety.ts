export type ScheduleConfirmationReason =
  | "past_today"
  | "weekend_day"
  | "after_work_time"
  | "assumed_meridiem"
  | "multiple_clocks";

export type ScheduleConfirmationChoiceId =
  | "tomorrow_same_time"
  | "saturday"
  | "sunday"
  | "after_work_18"
  | "after_work_19"
  | "morning"
  | "afternoon"
  | "no_time";

export type ScheduleConfirmationChoice = {
  id: ScheduleConfirmationChoiceId;
  label: string;
  resolvedText: string;
};

type MentionedTime = { hour: number; minute: number };
type BareClock = { hour: number; minute: number | null };

const KO_CLOCK_RANGE_RE =
  /(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*부터\s*(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*까지/;

function inheritRangeMeridiem(text: string): string {
  return text.replace(
    KO_CLOCK_RANGE_RE,
    (
      match,
      startPeriod: string | undefined,
      startHour: string,
      startHalf: string | undefined,
      startMinute: string | undefined,
      endPeriod: string | undefined,
      endHour: string,
      endHalf: string | undefined,
      endMinute: string | undefined,
    ) => {
      if (!startPeriod || endPeriod) return match;
      const startMinuteLabel =
        startHalf === "반" ? " 반" : startMinute ? ` ${startMinute}분` : "";
      const endMinuteLabel =
        endHalf === "반" ? " 반" : endMinute ? ` ${endMinute}분` : "";
      return `${startPeriod} ${startHour}시${startMinuteLabel}부터 ${startPeriod} ${endHour}시${endMinuteLabel}까지`;
    },
  );
}

function parseMentionedTime(text: string): MentionedTime | null {
  const ko = text.match(
    /(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/,
  );
  if (ko) {
    let hour = Number(ko[2]);
    const minute = ko[3] === "반" ? 30 : ko[4] ? Number(ko[4]) : 0;
    if (ko[1] === "오후" && hour < 12) hour += 12;
    else if (ko[1] === "오전" && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  const en = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (en) {
    let hour = Number(en[1]);
    const minute = en[2] ? Number(en[2]) : 0;
    if (en[3].toLowerCase() === "pm" && hour < 12) hour += 12;
    if (en[3].toLowerCase() === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }

  const clock24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return clock24
    ? { hour: Number(clock24[1]), minute: Number(clock24[2]) }
    : null;
}

function extractBareClock(text: string): BareClock | null {
  const normalized = inheritRangeMeridiem(text);
  for (const match of normalized.matchAll(
    /(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/g,
  )) {
    const hour = Number(match[1]);
    // 1–12 without meridiem is ambiguous; 13–23 is 24h-style and resolved.
    if (hour < 1 || hour > 12) continue;
    const prefix = normalized.slice(Math.max(0, (match.index ?? 0) - 4), match.index);
    if (/(오전|오후)\s*$/.test(prefix)) continue;
    return {
      hour,
      minute: match[2] === "반" ? 30 : match[3] ? Number(match[3]) : null,
    };
  }

  const en = normalized.match(
    /\bat\s+(1[0-2]|[1-9])(?::([0-5]\d))?(?!\s*(?:am|pm)\b)/i,
  );
  return en
    ? { hour: Number(en[1]), minute: en[2] ? Number(en[2]) : null }
    : null;
}

export function hasAmbiguousBareMeridiem(text: string): boolean {
  return extractBareClock(text) !== null;
}

function hasBareMeridiemGuess(text: string): boolean {
  return hasAmbiguousBareMeridiem(text);
}

export function countDistinctClockMentions(text: string): number {
  const ko = [
    ...text.matchAll(
      /(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/g,
    ),
  ];
  const enAmPm = [
    ...text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi),
  ];
  // Prefer Korean tokens when present; English am/pm is a separate count.
  return Math.max(ko.length, enAmPm.length);
}

/** A from–to clock range is one event, not two separate schedule items. */
export function isSingleClockRange(text: string): boolean {
  const match = text.match(KO_CLOCK_RANGE_RE);
  if (!match) return false;
  const withoutRange = text.replace(KO_CLOCK_RANGE_RE, " ");
  return countDistinctClockMentions(withoutRange) === 0;
}

/** Rough per-clock lines for multi-clock honesty UI (display only). */
export function extractClockPlanLines(text: string): string[] {
  const trimmed = text.trim();
  const ko = [
    ...trimmed.matchAll(
      /(?:(?:오늘|내일|모레)\s*)?(?:오전|오후)?\s*\d{1,2}\s*시(?:\s*반|(?:\s*\d{1,2}\s*분))?\s*[^,，/]*/g,
    ),
  ]
    .map((m) => m[0].replace(/[,，/]+$/, "").trim())
    .filter(Boolean);
  if (ko.length >= 2) return ko;

  const en = [
    ...trimmed.matchAll(
      /\b(?:today|tomorrow)?\s*(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b[^,;]*/gi,
    ),
  ]
    .map((m) => m[0].trim())
    .filter(Boolean);
  return en.length >= 2 ? en : ko.length > 0 ? ko : [trimmed];
}

function replaceTodayWithTomorrow(text: string): string {
  if (/오늘/.test(text)) return text.replace(/오늘/, "내일");
  return text.replace(/\btoday\b/i, "tomorrow");
}

function replaceWeekend(
  text: string,
  day: "saturday" | "sunday",
): string {
  const koDay = day === "saturday" ? "이번 주 토요일" : "이번 주 일요일";
  const enDay = day === "saturday" ? "this Saturday" : "this Sunday";
  if (/주말/.test(text)) return text.replace(/주말/, koDay);
  return text.replace(/\bweekend\b/i, enDay);
}

function replaceAfterWork(text: string, hour: 18 | 19): string {
  const koTime = hour === 18 ? "오후 6시" : "오후 7시";
  const enTime = hour === 18 ? "at 6pm" : "at 7pm";
  const koResolved = text.replace(
    /퇴근\s*(?:후|하고|하고서|뒤)/,
    koTime,
  );
  if (koResolved !== text) return koResolved;
  return text.replace(/\bafter\s+work\b/i, enTime);
}

function replaceBareMeridiem(text: string, period: "am" | "pm"): string {
  const koPeriod = period === "am" ? "오전" : "오후";
  const koResolved = text.replace(
    /(^|[\s(])(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/,
    (
      _match,
      prefix: string,
      hour: string,
      half?: string,
      minute?: string,
    ) => {
      const minuteLabel =
        half === "반" ? " 반" : minute ? ` ${minute}분` : "";
      return `${prefix}${koPeriod} ${hour}시${minuteLabel}`;
    },
  );
  if (koResolved !== text) return koResolved;

  return text.replace(
    /\bat\s+(1[0-2]|[1-9])(?::([0-5]\d))?(?!\s*(?:am|pm)\b)/i,
    (_match, hour: string, minute?: string) =>
      `at ${hour}${minute ? `:${minute}` : ""}${period}`,
  );
}

/** Drop an ambiguous bare clock so the remaining date can stay as all-day. */
function stripBareClock(text: string): string {
  const rangeResolved = text.replace(KO_CLOCK_RANGE_RE, " ");
  if (rangeResolved !== text) {
    return rangeResolved.replace(/\s+/g, " ").trim();
  }

  const koResolved = text.replace(
    /(^|[\s(])(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/,
    "$1",
  );
  if (koResolved !== text) {
    return koResolved
      .replace(/\s+에\s+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return text
    .replace(/\bat\s+(1[0-2]|[1-9])(?::([0-5]\d))?(?!\s*(?:am|pm)\b)/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function assumedMeridiemQuestion(
  text: string,
  lang: "ko" | "en",
): string {
  const clock = extractBareClock(text);
  if (lang === "en") {
    if (!clock) return "Which time should I remember?";
    const minute =
      clock.minute === null
        ? ""
        : `:${String(clock.minute).padStart(2, "0")}`;
    return `Is ${clock.hour}${minute} morning or afternoon?`;
  }
  if (!clock) return "몇 시로 기억할까요?";
  return `${clock.hour}시는 언제인가요?`;
}

function clockChoiceLabel(
  clock: BareClock,
  period: "am" | "pm",
  lang: "ko" | "en",
): string {
  const minute =
    clock.minute === null
      ? ""
      : `:${String(clock.minute).padStart(2, "0")}`;
  if (lang === "en") return `${clock.hour}${minute} ${period.toUpperCase()}`;
  const koPeriod = period === "am" ? "오전" : "오후";
  const koMinute =
    clock.minute === null
      ? ""
      : clock.minute === 30
        ? " 반"
        : ` ${clock.minute}분`;
  return `${koPeriod} ${clock.hour}시${koMinute}`;
}

export function scheduleConfirmationReasons(
  text: string,
  now = new Date(),
): ScheduleConfirmationReason[] {
  const trimmed = text.trim();
  const reasons: ScheduleConfirmationReason[] = [];
  const bareMeridiem = hasBareMeridiemGuess(trimmed);

  // Two independent clocks stay blocked, but a from–to range is one event.
  if (countDistinctClockMentions(trimmed) >= 2 && !isSingleClockRange(trimmed)) {
    reasons.push("multiple_clocks");
  }

  // Resolve AM/PM before evaluating whether a time has already passed.
  if (bareMeridiem) reasons.push("assumed_meridiem");

  if (!bareMeridiem && /(오늘|\btoday\b)/i.test(trimmed)) {
    const time = parseMentionedTime(inheritRangeMeridiem(trimmed));
    if (time) {
      const mentioned = new Date(now);
      mentioned.setHours(time.hour, time.minute, 0, 0);
      if (mentioned.getTime() <= now.getTime()) reasons.push("past_today");
    }
  }

  if (/(주말|\bweekend\b)/i.test(trimmed)) reasons.push("weekend_day");
  if (/(퇴근\s*(?:후|하고|하고서|뒤)|\bafter\s+work\b)/i.test(trimmed)) {
    reasons.push("after_work_time");
  }

  return reasons;
}

/**
 * Returns the first unsafe assumption. Inputs with multiple assumptions should
 * fall back to the manual schedule sheet instead of stacking silent fixes.
 */
export function scheduleConfirmationReason(
  text: string,
  now = new Date(),
): ScheduleConfirmationReason | null {
  return scheduleConfirmationReasons(text, now)[0] ?? null;
}

/**
 * Contextual one-tap fixes for a single ambiguity. The returned text is fed
 * back through the existing deterministic parser, so no new scheduling path is
 * introduced.
 */
export function scheduleConfirmationChoices(
  text: string,
  reason: ScheduleConfirmationReason,
  lang: "ko" | "en",
  now = new Date(),
): ScheduleConfirmationChoice[] {
  const reasons = scheduleConfirmationReasons(text, now);
  if (reasons.length !== 1 || reasons[0] !== reason) return [];

  // No one-tap merge of multiple timed plans — open the manual sheet instead.
  if (reason === "multiple_clocks") return [];

  if (reason === "past_today") {
    const resolvedText = replaceTodayWithTomorrow(text);
    return resolvedText === text
      ? []
      : [
          {
            id: "tomorrow_same_time",
            label: lang === "en" ? "Tomorrow, same time" : "내일 같은 시간",
            resolvedText,
          },
        ];
  }

  if (reason === "weekend_day") {
    return [
      {
        id: "saturday",
        label: lang === "en" ? "Saturday" : "토요일",
        resolvedText: replaceWeekend(text, "saturday"),
      },
      {
        id: "sunday",
        label: lang === "en" ? "Sunday" : "일요일",
        resolvedText: replaceWeekend(text, "sunday"),
      },
    ];
  }

  if (reason === "after_work_time") {
    return [
      {
        id: "after_work_18",
        label: lang === "en" ? "6 PM" : "오후 6시",
        resolvedText: replaceAfterWork(text, 18),
      },
      {
        id: "after_work_19",
        label: lang === "en" ? "7 PM" : "오후 7시",
        resolvedText: replaceAfterWork(text, 19),
      },
    ];
  }

  const clock = extractBareClock(text);
  if (!clock) return [];
  return [
    {
      id: "morning",
      label: clockChoiceLabel(clock, "am", lang),
      resolvedText: replaceBareMeridiem(text, "am"),
    },
    {
      id: "afternoon",
      label: clockChoiceLabel(clock, "pm", lang),
      resolvedText: replaceBareMeridiem(text, "pm"),
    },
    {
      id: "no_time",
      label: lang === "en" ? "No time" : "시간 없이",
      resolvedText: stripBareClock(text),
    },
  ];
}
