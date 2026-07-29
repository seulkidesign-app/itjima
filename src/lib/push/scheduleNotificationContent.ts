import type { ScheduleItem } from "@/lib/store";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";
import { resolveScheduleAllDayFlags } from "@/lib/scheduleTime";
import { effectiveAlarmAt } from "@/lib/scheduleReminders";

export type ReminderNotificationCopy = {
  title: string;
  body: string;
  url: string;
};

export function formatReminderFireTime(
  at: Date,
  lang: "ko" | "en",
): string {
  if (lang === "ko") {
    const hours = at.getHours();
    const minutes = at.getMinutes();
    const period = hours < 12 ? "오전" : "오후";
    const h12 = hours % 12 || 12;
    const min = minutes.toString().padStart(2, "0");
    return `${period} ${h12}:${min}`;
  }
  return at.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function buildReminderNotificationCopy(
  schedule: Pick<ScheduleItem, "id" | "text" | "start_time" | "end_time" | "all_day" | "start_all_day" | "end_all_day" | "alarm" | "alarm_at">,
  lang: "ko" | "en",
): ReminderNotificationCopy {
  const titleText = scheduleDisplayTitle(schedule).trim();
  const title = titleText || (lang === "ko" ? "잊지마" : "Itjima");
  const flags = resolveScheduleAllDayFlags(schedule as ScheduleItem);
  const startAt = new Date(schedule.start_time);

  let body: string;
  if (flags.startAllDay || Number.isNaN(startAt.getTime())) {
    body =
      lang === "ko"
        ? "예정된 일정이에요."
        : "You have a schedule coming up.";
  } else {
    const timeLabel = formatReminderFireTime(startAt, lang);
    body =
      lang === "ko"
        ? `${timeLabel} 일정이에요.`
        : `Scheduled for ${timeLabel}.`;
  }

  return {
    title,
    body,
    url: `/schedule?open=${encodeURIComponent(schedule.id)}`,
  };
}

export function buildSaveSuccessCopy(
  schedule: Pick<ScheduleItem, "id" | "text" | "start_time" | "alarm" | "alarm_at" | "all_day" | "start_all_day" | "end_all_day">,
  lang: "ko" | "en",
  opts?: { notificationReady?: boolean },
): { headline: string; detail?: string } {
  if (!schedule.alarm || !opts?.notificationReady) {
    return {
      headline:
        lang === "ko" ? "일정을 저장했어요." : "Schedule saved.",
    };
  }

  const fireAt = effectiveAlarmAt(schedule as ScheduleItem);
  if (!fireAt) {
    return {
      headline:
        lang === "ko" ? "일정을 저장했어요." : "Schedule saved.",
    };
  }

  const now = new Date();
  const isToday = fireAt.toDateString() === now.toDateString();
  const timeLabel = formatReminderFireTime(fireAt, lang);
  const whenLabel =
    lang === "ko"
      ? isToday
        ? `오늘 ${timeLabel}`
        : timeLabel
      : isToday
        ? `today at ${timeLabel}`
        : timeLabel;
  return {
    headline: lang === "ko" ? "알림 준비 완료" : "Notifications ready",
    detail:
      lang === "ko"
        ? `${whenLabel}에 알려드릴게요.`
        : `We'll remind you at ${whenLabel}.`,
  };
}
