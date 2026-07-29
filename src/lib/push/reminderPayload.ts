import type { ScheduleItem } from "@/lib/store";
import { buildReminderNotificationCopy } from "@/lib/push/scheduleNotificationContent";

/** Web Push payload for a schedule reminder. */
export type ReminderPushPayload = {
  title: string;
  body: string;
  tag: string;
  data: {
    url: string;
    scheduleId: string;
  };
};

export function buildReminderPushPayload(
  schedule: Pick<
    ScheduleItem,
    | "id"
    | "text"
    | "start_time"
    | "end_time"
    | "all_day"
    | "start_all_day"
    | "end_all_day"
    | "alarm"
    | "alarm_at"
  >,
  lang: "ko" | "en" = "ko",
): ReminderPushPayload {
  const copy = buildReminderNotificationCopy(schedule, lang);
  return {
    title: copy.title,
    body: copy.body,
    tag: `schedule-${schedule.id}`,
    data: {
      url: copy.url,
      scheduleId: schedule.id,
    },
  };
}

export function reminderClickUrl(scheduleId: string): string {
  return `/schedule?open=${scheduleId}`;
}

export function reminderIdempotencyKey(
  scheduleId: string,
  dueAtUtc: string,
): string {
  return `${scheduleId}:${dueAtUtc}`;
}
