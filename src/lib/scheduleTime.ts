import type { ScheduleItem } from "@/lib/store";

/** Countdown ring + remaining-time helpers for Schedule v0.3 */

export function isScheduleStartOfDay(d: Date): boolean {
  return d.getHours() === 0 && d.getMinutes() === 0;
}

export function isScheduleEndOfDay(d: Date): boolean {
  return d.getHours() === 23 && d.getMinutes() === 59;
}

export function inferScheduleAllDayFlags(
  start: Date,
  end: Date,
  legacyAllDay?: boolean,
): { startAllDay: boolean; endAllDay: boolean } {
  if (legacyAllDay === true) {
    return { startAllDay: true, endAllDay: true };
  }
  return {
    startAllDay: isScheduleStartOfDay(start),
    endAllDay: isScheduleEndOfDay(end),
  };
}

function hasStoredAllDayFlag(value: boolean | null | undefined): value is boolean {
  return value !== undefined && value !== null;
}

export function resolveScheduleAllDayFlags(
  item: Pick<
    ScheduleItem,
    "start_time" | "end_time" | "all_day" | "start_all_day" | "end_all_day"
  >,
): { startAllDay: boolean; endAllDay: boolean } {
  const startFlag = item.start_all_day;
  const endFlag = item.end_all_day;
  if (hasStoredAllDayFlag(startFlag) || hasStoredAllDayFlag(endFlag)) {
    const legacy = item.all_day === true;
    return {
      startAllDay: hasStoredAllDayFlag(startFlag) ? startFlag : legacy,
      endAllDay: hasStoredAllDayFlag(endFlag) ? endFlag : legacy,
    };
  }
  return inferScheduleAllDayFlags(
    new Date(item.start_time),
    new Date(item.end_time),
    item.all_day,
  );
}

export type ScheduleAllDayFields = Pick<
  ScheduleItem,
  "all_day" | "start_all_day" | "end_all_day"
>;

export function scheduleAllDayFieldsFromConfirm(opts: {
  allDay: boolean;
  startAllDay: boolean;
  endAllDay: boolean;
}): ScheduleAllDayFields {
  return {
    all_day: opts.startAllDay && opts.endAllDay,
    start_all_day: opts.startAllDay,
    end_all_day: opts.endAllDay,
  };
}

export function scheduleAllDayFieldsFromItem(
  item: Pick<
    ScheduleItem,
    | "all_day"
    | "start_all_day"
    | "end_all_day"
    | "start_time"
    | "end_time"
  >,
): ScheduleAllDayFields {
  const flags = resolveScheduleAllDayFlags(item);
  return scheduleAllDayFieldsFromConfirm({
    allDay: flags.startAllDay && flags.endAllDay,
    startAllDay: flags.startAllDay,
    endAllDay: flags.endAllDay,
  });
}

function formatKoreanClock(d: Date): string {
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours < 12 ? "오전" : "오후";
  const h12 = hours % 12 || 12;
  if (minutes === 0) return `${period} ${h12}시`;
  return `${period} ${h12}:${minutes.toString().padStart(2, "0")}`;
}

function formatEnglishClock(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** One-line summary for the schedule time step (QA #7 mockup pattern). */
export function formatScheduleConfigSummary(
  startAllDay: boolean,
  endAllDay: boolean,
  start: Date,
  end: Date,
  lang: "ko" | "en",
): string {
  if (lang === "ko") {
    const startPart = startAllDay
      ? "시작은 하루 종일"
      : `시작은 ${formatKoreanClock(start)}`;
    const endPart = endAllDay
      ? "종료는 하루 종일"
      : `종료는 ${formatKoreanClock(end)}까지`;
    return `${startPart}, ${endPart}로 설정돼요.`;
  }
  const startPart = startAllDay
    ? "Start is all-day"
    : `Start is ${formatEnglishClock(start)}`;
  const endPart = endAllDay
    ? "end is all-day"
    : `end is until ${formatEnglishClock(end)}`;
  return `${startPart}, ${endPart}.`;
}

export type RemainingParts = {
  ms: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
};

export function remainingUntil(target: Date, now = new Date()): RemainingParts {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) {
    return {
      ms: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      past: true,
    };
  }
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { ms, days, hours, minutes, seconds, past: false };
}

/** 0→1 fill as the event approaches (Apple-style urgency ring). */
export function countdownRingProgress(
  startIso: string,
  createdIso?: string,
  now = Date.now(),
): number {
  const start = new Date(startIso).getTime();
  if (start <= now) return 1;
  const created = createdIso ? new Date(createdIso).getTime() : now;
  const windowMs = Math.min(
    24 * 3600_000,
    Math.max(3600_000, start - Math.min(created, start - 3600_000)),
  );
  const windowStart = start - windowMs;
  const elapsed = now - windowStart;
  return Math.min(1, Math.max(0, elapsed / windowMs));
}

export function formatRemainingCompact(
  target: Date,
  lang: "ko" | "en",
  now = new Date(),
): string {
  const r = remainingUntil(target, now);
  if (r.past) return lang === "en" ? "Started" : "시작됨";
  if (r.days > 0) {
    return lang === "en"
      ? `${r.days}d ${r.hours}h`
      : `${r.days}일 ${r.hours}시간`;
  }
  if (r.hours > 0) {
    return lang === "en"
      ? `${r.hours}h ${r.minutes}m`
      : `${r.hours}시간 ${r.minutes}분`;
  }
  if (r.minutes > 0) {
    return lang === "en" ? `${r.minutes}m` : `${r.minutes}분`;
  }
  return lang === "en" ? `${r.seconds}s` : `${r.seconds}초`;
}

export type ScheduleDotStatus = "urgent" | "today" | "later";

/** Red = within 10 min or past; yellow = today; gray = later. */
export function scheduleDotStatus(
  start: Date,
  now = new Date(),
): ScheduleDotStatus {
  const r = remainingUntil(start, now);
  if (r.past || (r.ms > 0 && r.ms < 10 * 60_000)) return "urgent";
  if (start.toDateString() === now.toDateString()) return "today";
  return "later";
}

/** Loose schedule time — no second/minute countdown strings. */
export function formatScheduleTimeLoose(
  target: Date,
  lang: "ko" | "en",
  now = new Date(),
): string {
  const locale = lang === "en" ? "en-US" : "ko-KR";
  const r = remainingUntil(target, now);
  const sameDay = target.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = target.toDateString() === tomorrow.toDateString();

  if (sameDay) {
    const time = target.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return lang === "en" ? `Today ${time}` : `오늘 ${time}`;
  }
  if (isTomorrow) return lang === "en" ? "Tomorrow" : "내일";
  if (r.ms > 0 && r.ms < 24 * 3600_000 && r.hours >= 2) {
    return lang === "en" ? `${r.hours}h later` : `${r.hours}시간 후`;
  }
  if (r.past) return lang === "en" ? "Started" : "시작됨";
  return target.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

export function formatRemainingLong(
  target: Date,
  lang: "ko" | "en",
  now = new Date(),
): string {
  const r = remainingUntil(target, now);
  if (r.past) return lang === "en" ? "Started" : "시작됨";
  if (r.days > 0) {
    return lang === "en"
      ? `${r.days}d ${r.hours}h left`
      : `${r.days}일 ${r.hours}시간 남음`;
  }
  if (r.hours > 0) {
    return lang === "en"
      ? `${r.hours}h ${r.minutes}m left`
      : `${r.hours}시간 ${r.minutes}분 남음`;
  }
  if (r.minutes > 0) {
    return lang === "en" ? `${r.minutes}m left` : `${r.minutes}분 남음`;
  }
  return lang === "en" ? `${r.seconds}s left` : `${r.seconds}초 남음`;
}

export function nextWeekendMorning(now = new Date()): Date {
  const d = new Date(now);
  const day = d.getDay();
  let add = (6 - day + 7) % 7;
  if (day === 6 && d.getHours() < 10) add = 0;
  else if (add === 0 && day !== 6) add = 7;
  d.setDate(d.getDate() + add);
  d.setHours(10, 0, 0, 0);
  return d;
}

export function tonightAt(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(20, 0, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 1);
    d.setHours(20, 0, 0, 0);
  }
  return d;
}
