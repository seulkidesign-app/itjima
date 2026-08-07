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
  /(?:오전|오후|아침|점심|저녁|밤|새벽|퇴근\s*(?:후|하고|하고서|뒤)|\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?|\b(?:morning|afternoon|evening|tonight|noon|midnight|after\s+work)\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b)/i;

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
  if (/(?:2\s*시간\s*전|2\s*hours?\s+before)/i.test(value)) {
    return { minutes: 120, explicit: true };
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
    .replace(/(?:그리고\s*)?(?:전날|하루\s*전|1\s*일\s*전|2\s*시간\s*전|1\s*시간\s*전|한\s*시간\s*전|30\s*분\s*전|10\s*분\s*전|5\s*분\s*전|그때|시작할\s*때)?\s*(?:에도?\s*)?(?:알려\s*줘|알려줘|알림\s*(?:해|줘)|리마인드(?:\s*해줘)?)/gi, " ")
    .replace(/\b(?:remind|notify)\s+me(?:\s+(?:the\s+day\s+before|\d+\s*(?:minutes?|hours?|days?)\s+before|then))?\b/gi, " ")
    .replace(/(?:다음\s*주|이번\s*주)\s*/g, " ")
    .replace(/\b(?:next|this)\s+week\b/gi, " ")
    .replace(/(일|월|화|수|목|금|토)요일/g, " ")
    .replace(/\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, " ")
    .replace(/(?:오늘|내일|모레|글피|주말)/g, " ")
    .replace(/\b(?:today|tomorrow|weekend)\b/gi, " ")
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, " ")
    .replace(/(?:오전|오후)?\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/g, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, " ")
    .replace(/퇴근\s*(?:후|하고|하고서|뒤)/g, " ")
    .replace(/\bafter\s+work\b/gi, " ")
    .replace(/[,.]\s*$/g, "")
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
  if (minutes === 120) return lang === "en" ? "2 hours before" : "2시간 전";
  if (minutes === 24 * 60) return lang === "en" ? "1 day before" : "전날";
  return lang === "en" ? `${minutes} min before` : `${minutes}분 전`;
}
