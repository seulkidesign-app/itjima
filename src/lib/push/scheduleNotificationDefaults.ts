import type { ReminderKey } from "@/lib/scheduleChoices";
import { reminderToMinutes } from "@/lib/scheduleChoices";
import type { ScheduleItem } from "@/lib/store";
import { effectiveAlarmAt } from "@/lib/scheduleReminders";

const REMINDER_KEYS: ReminderKey[] = ["at", "5m", "10m", "30m", "1h", "1d", "off"];

export function defaultReminderForNewSchedule(hasSpecificTime: boolean): ReminderKey {
  return hasSpecificTime ? "at" : "off";
}

export function inferReminderKeyFromSchedule(
  schedule: Pick<ScheduleItem, "alarm" | "alarm_at" | "start_time">,
): ReminderKey {
  if (!schedule.alarm) return "off";
  const start = new Date(schedule.start_time).getTime();
  const fireAt = effectiveAlarmAt(schedule as ScheduleItem);
  if (!fireAt) return "at";
  const diffMin = Math.max(0, Math.round((start - fireAt.getTime()) / 60_000));

  let best: ReminderKey = "at";
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const key of REMINDER_KEYS) {
    if (key === "off") continue;
    const minutes = reminderToMinutes(key);
    if (minutes == null) continue;
    const distance = Math.abs(minutes - diffMin);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = key;
    }
  }
  return best;
}

export function scheduleHasSpecificTime(startAllDay: boolean, endAllDay: boolean): boolean {
  return !(startAllDay && endAllDay);
}
