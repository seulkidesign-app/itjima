import type { ScheduleConfirmOptions } from "@/components/ScheduleChoiceFlow";
import { detectDate } from "@/lib/dateDetect";
import {
  defaultEndFromStart,
  endOfDay,
  startOfDay,
} from "@/lib/scheduleChoices";
import type { InboxItem } from "@/lib/store";
import { thoughtFirstLine } from "@/lib/brainMirror";

const EXPLICIT_TIME_RE =
  /(?:오전|오후|아침|점심|저녁|밤|새벽|퇴근\s*(?:후|하고|하고서|뒤)|(?:\d+|한|두|세|네)\s*(?:분|시간)\s*(?:뒤|후)|반\s*시간\s*(?:뒤|후)|\d{1,2}\s*시(?:\s*반|(?:\s*\d{1,2}\s*분))?|\b(?:morning|afternoon|evening|tonight|noon|midnight|after\s+work)\b|\bin\s+(?:\d+|an?|one|two|three|four|half(?:\s+an?)?)\s*(?:minutes?|mins?|hours?|hrs?)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b)/i;

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

export function hasNaturalScheduleTime(text: string): boolean {
  return EXPLICIT_TIME_RE.test(text.trim());
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

  const afterWork = /퇴근\s*(?:후|하고|하고서|뒤)|\bafter\s+work\b/i.test(text);
  if (afterWork) {
    d.setHours(18, 0, 0, 0);
    return d;
  }

  if (detected && hasNaturalScheduleTime(text)) {
    d.setHours(detected.getHours(), detected.getMinutes(), 0, 0);
    return d;
  }

  if (/저녁|\bevening\b|\btonight\b/i.test(text)) d.setHours(18, 0, 0, 0);
  else if (/아침|\bmorning\b/i.test(text)) d.setHours(9, 0, 0, 0);
  else if (/점심|\bnoon\b|\blunch\b/i.test(text)) d.setHours(12, 0, 0, 0);
  else d.setHours(9, 0, 0, 0);

  return d;
}

export function resolveNaturalScheduleStart(text: string, now = new Date()): Date | null {
  const relative = relativeOffsetStart(text, now);
  if (relative) return relative;

  const detected = detectDate(text);
  const anchored = nextWeekWeekday(text, now);

  if (anchored) return applyNaturalTime(anchored, text, detected?.start ?? null);
  if (!detected) return null;

  const result = new Date(detected.start);
  if (/퇴근\s*(?:하고|하고서|뒤)/i.test(text)) result.setHours(18, 0, 0, 0);
  return result;
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

function cleanScheduleTitle(text: string): string {
  let title = thoughtFirstLine(text);

  title = title
    .replace(/(?:그리고\s*)?(?:전날|하루\s*전|1\s*일\s*전|1\s*시간\s*전|한\s*시간\s*전|30\s*분\s*전|10\s*분\s*전|5\s*분\s*전|그때|시작할\s*때)?\s*(?:에도?\s*)?(?:알려\s*줘|알려줘|알림\s*(?:해|줘)|리마인드(?:\s*해줘)?)/gi, " ")
    .replace(/\b(?:remind|notify)\s+me(?:\s+(?:the\s+day\s+before|(?:1\s*hour|30\s*minutes?|10\s*minutes?|5\s*minutes?)\s+before|then))?\b/gi, " ")
    .replace(/(?:\d+|한|두|세|네)\s*(?:분|시간|일)\s*(?:뒤|후)/g, " ")
    .replace(/반\s*시간\s*(?:뒤|후)/g, " ")
    .replace(/\bin\s+(?:\d+|an?|one|two|three|four)\s*(?:minutes?|mins?|hours?|hrs?|days?)\b/gi, " ")
    .replace(/\bin\s+half(?:\s+an?)?\s+hour\b/gi, " ")
    .replace(/(?:다음\s*주|이번\s*주)\s*/g, " ")
    .replace(/\b(?:next|this)\s+week\b/gi, " ")
    .replace(/(일|월|화|수|목|금|토)요일/g, " ")
    .replace(/\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, " ")
    .replace(/(?:오늘|내일|모레|글피|주말)/g, " ")
    .replace(/\b(?:today|tomorrow|weekend)\b/gi, " ")
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, " ")
    .replace(/(?:오전|오후)?\s*\d{1,2}\s*시(?:\s*반|(?:\s*\d{1,2}\s*분))?/g, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, " ")
    .replace(/퇴근\s*(?:후|하고|하고서|뒤)/g, " ")
    .replace(/\bafter\s+work\b/gi, " ")
    // Removing an English time can leave its scheduling preposition behind
    // ("Dentist tomorrow at 3pm" -> "Dentist at"). Only strip a dangling
    // terminal connector so semantic phrases such as "Meet at the clinic" stay.
    .replace(/\b(?:at|on|by)\b(?=\s*(?:[,.!?]|$))/gi, " ")
    .replace(/^(?:에|에서|까지|부터)\s+/g, "")
    .replace(/\s+(?:에|에서|까지|부터)$/g, "")
    .replace(/[,.!?]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return title || thoughtFirstLine(text).trim();
}

export function buildNaturalScheduleDraft(item: InboxItem): NaturalScheduleDraft {
  const startResolved = resolveNaturalScheduleStart(item.text);
  const explicitTime = hasNaturalScheduleTime(item.text);
  const dateOnly = Boolean(startResolved) && !explicitTime;
  const start = startResolved
    ? dateOnly
      ? startOfDay(startResolved)
      : startResolved
    : (() => {
        const d = new Date();
        d.setMinutes(0, 0, 0);
        if (d.getHours() < 9) d.setHours(9, 0, 0, 0);
        else if (d.getHours() >= 18) {
          d.setDate(d.getDate() + 1);
          d.setHours(9, 0, 0, 0);
        } else d.setHours(d.getHours() + 1, 0, 0, 0);
        return d;
      })();
  const end = dateOnly ? endOfDay(start) : defaultEndFromStart(start);
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
