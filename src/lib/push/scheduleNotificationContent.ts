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

function formatReminderFireMoment(
  at: Date,
  lang: "ko" | "en",
  now = new Date(),
): string {
  const time = formatReminderFireTime(at, lang);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  if (at >= today && at < tomorrow) {
    return lang === "ko" ? `오늘 ${time}` : `Today at ${time}`;
  }
  if (at >= tomorrow && at < dayAfter) {
    return lang === "ko" ? `내일 ${time}` : `Tomorrow at ${time}`;
  }

  const date = at.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  return lang === "ko" ? `${date} ${time}` : `${date} at ${time}`;
}

/**
 * Format an absolute instant in a specific IANA timezone.
 * Edge Functions run in UTC — never use Date#getHours() for user-facing copy.
 */
export function formatReminderTimeInTimeZone(
  iso: string,
  timeZone: string,
  lang: "ko" | "en" = "ko",
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const tz = timeZone || "Asia/Seoul";
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }
}

export function buildReminderNotificationCopy(
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
  schedule: Pick<
    ScheduleItem,
    | "id"
    | "text"
    | "start_time"
    | "alarm"
    | "alarm_at"
    | "all_day"
    | "start_all_day"
    | "end_all_day"
  >,
  lang: "ko" | "en",
  opts?: { notificationReady?: boolean },
): { headline: string; detail?: string } {
  if (!schedule.alarm) {
    return {
      headline:
        lang === "ko" ? "일정을 저장했어요." : "Schedule saved.",
      detail:
        lang === "ko" ? "알림은 설정하지 않았어요." : "No reminder is set.",
    };
  }

  const fireAt = effectiveAlarmAt(schedule as ScheduleItem);
  if (!fireAt) {
    return {
      headline:
        lang === "ko"
          ? "일정 저장됨 · 알림 시간 확인 필요"
          : "Schedule saved · Check reminder time",
      detail:
        lang === "ko"
          ? "일정에서 알림 시간을 다시 확인해 주세요."
          : "Open the schedule and check the reminder time.",
    };
  }

  const moment = formatReminderFireMoment(fireAt, lang);
  const title = scheduleDisplayTitle(schedule).trim();

  if (!opts?.notificationReady) {
    return {
      headline:
        lang === "ko"
          ? "일정 저장됨 · 기기 알림 꺼짐"
          : "Schedule saved · Device alerts off",
      detail:
        lang === "ko"
          ? `${moment}에 알림을 원하면 이 기기의 알림을 켜야 해요.`
          : `Turn on device notifications to be alerted ${moment}.`,
    };
  }

  return {
    headline:
      lang === "ko"
        ? `🔔 알림 켜짐 · ${moment}`
        : `🔔 Reminder on · ${moment}`,
    detail:
      lang === "ko"
        ? title
          ? `“${title}” 일정 전에 알려드릴게요.`
          : "이 시각에 알려드릴게요."
        : title
          ? `We'll remind you before “${title}.”`
          : "We'll remind you at this time.",
  };
}
