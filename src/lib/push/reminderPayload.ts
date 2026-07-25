/** Privacy-safe Web Push payload — never includes raw thought text. */
export type ReminderPushPayload = {
  title: string;
  body: string;
  tag: string;
  data: {
    url: string;
    scheduleId: string;
  };
};

export function buildReminderPushPayload(scheduleId: string): ReminderPushPayload {
  return {
    title: "⏰ 잊지마",
    body: "예정된 일정 알림",
    tag: `schedule-${scheduleId}`,
    data: {
      url: `/schedule?open=${scheduleId}`,
      scheduleId,
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
