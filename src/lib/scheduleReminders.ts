import type { ScheduleItem } from "@/lib/store";

export type AlarmPreset =
  | "10m"
  | "30m"
  | "1h"
  | "tonight"
  | "tomorrow_am"
  | "custom";

const OFFSET_KEY = (id: string) => `itjima.schedule.reminder.${id}`;

/** Legacy offset-before-event (fallback when alarm_at missing). */
export type ReminderOffset = "at" | "10m" | "1h";

export function getReminderOffset(scheduleId: string): ReminderOffset {
  if (typeof window === "undefined") return "1h";
  const v = localStorage.getItem(OFFSET_KEY(scheduleId));
  if (v === "at" || v === "10m" || v === "1h") return v;
  return "1h";
}

export function setReminderOffset(scheduleId: string, offset: ReminderOffset) {
  localStorage.setItem(OFFSET_KEY(scheduleId), offset);
}

export function clearReminderOffset(scheduleId: string) {
  localStorage.removeItem(OFFSET_KEY(scheduleId));
}

export function reminderFireTime(
  startIso: string,
  offset: ReminderOffset,
): Date {
  const t = new Date(startIso);
  if (offset === "10m") t.setMinutes(t.getMinutes() - 10);
  else if (offset === "1h") t.setMinutes(t.getMinutes() - 60);
  return t;
}

function tonightAt(now = new Date()) {
  const d = new Date(now);
  d.setHours(18, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

function tomorrowMorning(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function presetToAlarmAt(preset: AlarmPreset, now = new Date()): Date {
  switch (preset) {
    case "10m":
      return new Date(now.getTime() + 10 * 60 * 1000);
    case "30m":
      return new Date(now.getTime() + 30 * 60 * 1000);
    case "1h":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "tonight":
      return tonightAt(now);
    case "tomorrow_am":
      return tomorrowMorning(now);
    default:
      return new Date(now.getTime() + 60 * 60 * 1000);
  }
}

export function effectiveAlarmAt(s: ScheduleItem): Date | null {
  if (!s.alarm) return null;
  if (s.alarm_at) return new Date(s.alarm_at);
  return reminderFireTime(s.start_time, getReminderOffset(s.id));
}

export function formatAlarmLabel(
  at: Date,
  lang: "ko" | "en",
  now = new Date(),
): string {
  const diffMs = at.getTime() - now.getTime();
  if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
    const mins = Math.round(diffMs / 60_000);
    if (mins < 60) return lang === "en" ? `in ${mins}m` : `${mins}분 후`;
    const hrs = Math.round(diffMs / 3_600_000);
    return lang === "en" ? `in ${hrs}h` : `${hrs}시간 후`;
  }

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfter = new Date(tomorrowStart);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const hh = at.getHours().toString().padStart(2, "0");
  const mm = at.getMinutes().toString().padStart(2, "0");
  const time = `${hh}:${mm}`;

  if (at >= todayStart && at < tomorrowStart) {
    return lang === "en" ? `Today ${time}` : `오늘 ${time}`;
  }
  if (at >= tomorrowStart && at < dayAfter) {
    const prefix = lang === "en" ? "Tomorrow" : "내일";
    const ampm =
      lang === "en"
        ? time
        : at.getHours() < 12
          ? `오전 ${at.getHours() || 12}:${mm}`
          : `오후 ${at.getHours() === 12 ? 12 : at.getHours() - 12}:${mm}`;
    return `${prefix} ${ampm}`;
  }

  return lang === "en"
    ? at.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : `${at.getMonth() + 1}/${at.getDate()} ${time}`;
}

const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

/** In-app notifications while the tab is open. */
export function bindInAppReminders(
  items: ScheduleItem[],
  notify: (title: string, body: string) => void,
): () => void {
  if (typeof window === "undefined" || !("Notification" in window))
    return () => {};

  const timers: number[] = [];

  for (const s of items) {
    if (!s.alarm || s.status === "done") continue;
    const fireAt = effectiveAlarmAt(s);
    if (!fireAt) continue;
    const delay = fireAt.getTime() - Date.now();
    if (delay <= 0 || delay > HORIZON_MS) continue;
    timers.push(
      window.setTimeout(() => {
        if (Notification.permission === "granted") {
          notify("⏰ ItJima", s.text);
        }
      }, delay),
    );
  }

  return () => timers.forEach(clearTimeout);
}
