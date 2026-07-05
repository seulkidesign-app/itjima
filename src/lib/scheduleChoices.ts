import { nextWeekendMorning } from "@/lib/scheduleTime";

export type WhenKey =
  | "today"
  | "tomorrow"
  | "weekend"
  | "next_week"
  | "pick_date";

export type TimeKey = "morning" | "afternoon" | "evening" | "custom";

export type ReminderKey = "at" | "5m" | "10m" | "30m" | "1h" | "1d" | "off";

const TIME_HOURS: Record<Exclude<TimeKey, "custom">, number> = {
  morning: 9,
  afternoon: 13,
  evening: 18,
};

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
