import { nextWeekendMorning } from "@/lib/scheduleTime";
import type { RepeatRule } from "@/lib/store";

export type WhenKey =
  | "today"
  | "tomorrow"
  | "weekend"
  | "next_week"
  | "pick_date";

export type TimeKey = "morning" | "afternoon" | "evening" | "custom";

export type ReminderKey = "at" | "5m" | "10m" | "30m" | "1h" | "1d" | "off";

export type RepeatKey = "none" | RepeatRule;

export const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const;

const TIME_HOURS: Record<Exclude<TimeKey, "custom">, number> = {
  morning: 9,
  afternoon: 13,
  evening: 18,
};

export function snapMinute(m: number): (typeof MINUTE_STEPS)[number] {
  let best: (typeof MINUTE_STEPS)[number] = MINUTE_STEPS[0];
  let diff = Math.abs(m - best);
  for (const step of MINUTE_STEPS) {
    const d = Math.abs(m - step);
    if (d < diff) {
      best = step;
      diff = d;
    }
  }
  return best;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function defaultEndFromStart(start: Date, minutes = 60): Date {
  return new Date(start.getTime() + minutes * 60 * 1000);
}

export function repeatKeyToRule(key: RepeatKey): RepeatRule | null {
  return key === "none" ? null : key;
}

export function repeatRuleToKey(rule: RepeatRule | null | undefined): RepeatKey {
  return rule ?? "none";
}

export function repeatLabel(
  key: RepeatKey,
  t: (ko: string, en: string) => string,
): string {
  switch (key) {
    case "none":
      return t("없음", "Never");
    case "daily":
      return t("매일", "Daily");
    case "weekly":
      return t("매주", "Weekly");
    case "monthly":
      return t("매월", "Monthly");
    case "yearly":
      return t("매년", "Yearly");
  }
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function nextWeekMorning(now = new Date()): Date {
  const d = new Date(now);
  const day = d.getDay();
  const add = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + add);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function baseDateForWhen(when: WhenKey, now = new Date()): Date {
  switch (when) {
    case "today":
      return startOfDay(now);
    case "tomorrow": {
      const d = startOfDay(now);
      d.setDate(d.getDate() + 1);
      return d;
    }
    case "weekend":
      return startOfDay(nextWeekendMorning(now));
    case "next_week":
      return startOfDay(nextWeekMorning(now));
    case "pick_date":
      return startOfDay(now);
  }
}

export function applyTimeToDate(
  base: Date,
  time: TimeKey,
  customHours?: number,
  customMinutes?: number,
): Date {
  const d = new Date(base);
  if (time === "custom") {
    d.setHours(customHours ?? 9, customMinutes ?? 0, 0, 0);
  } else {
    d.setHours(TIME_HOURS[time], 0, 0, 0);
  }
  return d;
}

export function reminderToMinutes(key: ReminderKey): number | null {
  switch (key) {
    case "off":
      return null;
    case "at":
      return 0;
    case "5m":
      return 5;
    case "10m":
      return 10;
    case "30m":
      return 30;
    case "1h":
      return 60;
    case "1d":
      return 24 * 60;
  }
}

export function inferWhenFromDate(d: Date, now = new Date()): WhenKey {
  const base = startOfDay(d);
  const today = startOfDay(now);
  const tomorrow = startOfDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekend = startOfDay(nextWeekendMorning(now));
  const nextWeek = startOfDay(nextWeekMorning(now));

  if (base.getTime() === today.getTime()) return "today";
  if (base.getTime() === tomorrow.getTime()) return "tomorrow";
  if (base.getTime() === weekend.getTime()) return "weekend";
  if (base.getTime() === nextWeek.getTime()) return "next_week";
  return "pick_date";
}

export function inferTimeFromDate(d: Date): TimeKey {
  const h = d.getHours();
  if (h === 9) return "morning";
  if (h === 13) return "afternoon";
  if (h === 18) return "evening";
  return "custom";
}

/** Calm one-line moment for the schedule suggestion card. */
export function formatSuggestedMoment(
  d: Date,
  lang: "ko" | "en",
  allDay = false,
): string {
  if (allDay) {
    const locale = lang === "en" ? "en-US" : "ko-KR";
    const date = d.toLocaleDateString(locale, {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    return lang === "en" ? `${date} · All day` : `${date} · 하루 종일`;
  }

  if (lang === "ko") {
    const datePart = d.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const period = hours < 12 ? "오전" : "오후";
    const h12 = hours % 12 || 12;
    const min = minutes.toString().padStart(2, "0");
    return `${datePart} ${period} ${h12}:${min}`;
  }

  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
