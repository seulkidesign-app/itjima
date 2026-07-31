import { readNotificationPermission } from "@/lib/alarmAvailability";
import {
  ensurePushSubscriptionForCurrentUser,
  isDevicePushRegisteredForCurrentUser,
  showLocalTestNotification,
} from "@/lib/push/pushSubscription";
import { buildReminderNotificationCopy, buildSaveSuccessCopy } from "@/lib/push/scheduleNotificationContent";
import { detectPushPlatform } from "@/lib/push/detectPushPlatform";
import { syncScheduleReminder } from "@/lib/push/scheduledRemindersSync";
import type { ScheduleItem } from "@/lib/store";

const ONBOARDING_SEEN_KEY = "itjima.notification.onboarding.seen";

export type PendingScheduleSave = {
  text: string;
  start: Date;
  end: Date;
  reminderMinutes: number | null;
  allDay: boolean;
  startAllDay: boolean;
  endAllDay: boolean;
  repeat: ScheduleItem["repeat"];
  isNew: boolean;
  edit?: ScheduleItem;
};

export type ScheduleSaveOutcome = {
  ok: boolean;
  item?: ScheduleItem;
  notificationReady: boolean;
  permission: NotificationPermission | "unsupported";
  showDeniedGuide: boolean;
  successCopy?: { headline: string; detail?: string };
  errorMessage?: string;
};

export function hasSeenNotificationOnboarding(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(ONBOARDING_SEEN_KEY) === "1";
}

export function markNotificationOnboardingSeen(): void {
  localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
}

export function shouldOfferNotificationOnboarding(
  wantsAlarm: boolean,
  hasSpecificTime: boolean,
  isNew: boolean,
): boolean {
  if (!isNew || !wantsAlarm || !hasSpecificTime) return false;
  if (hasSeenNotificationOnboarding()) return false;
  return readNotificationPermission() === "default";
}

async function showScheduleTestNotification(
  schedule: ScheduleItem,
  lang: "ko" | "en",
): Promise<boolean> {
  if (detectPushPlatform() === "ios-pwa") {
    return false;
  }
  const copy = buildReminderNotificationCopy(schedule, lang);
  try {
    const reg =
      (await navigator.serviceWorker?.ready?.catch(() => null)) ?? null;
    if (reg) {
      await reg.showNotification(copy.title, {
        body: copy.body,
        tag: `schedule-preview-${schedule.id}`,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        data: { url: copy.url, scheduleId: schedule.id },
      });
      return true;
    }
  } catch {
    // fall through
  }
  if (Notification.permission === "granted") {
    new Notification(copy.title, { body: copy.body });
    return true;
  }
  return showLocalTestNotification();
}

export async function ensureNotificationReadyForSave(
  lang: "ko" | "en",
): Promise<{ ready: boolean; permission: NotificationPermission | "unsupported" }> {
  const permission = readNotificationPermission();
  if (permission === "unsupported") {
    return { ready: false, permission };
  }
  if (permission === "denied") {
    return { ready: false, permission };
  }
  if (permission === "default") {
    return { ready: false, permission };
  }

  const push = await ensurePushSubscriptionForCurrentUser();
  if (!push.ok) {
    return { ready: false, permission };
  }
  const registered = await isDevicePushRegisteredForCurrentUser();
  return { ready: registered, permission };
}

export async function completeScheduleSaveWithNotifications(
  userId: string | null,
  pending: PendingScheduleSave,
  lang: "ko" | "en",
  persist: (
    alarm: { alarm: boolean; alarm_at?: string | null },
  ) => Promise<ScheduleItem>,
  opts?: {
    requestPermission?: () => Promise<NotificationPermission>;
    skipNotificationPrep?: boolean;
  },
): Promise<ScheduleSaveOutcome> {
  const permission = readNotificationPermission();
  const wantsAlarm = pending.reminderMinutes != null;
  const alarmPayload = wantsAlarm
    ? {
        alarm: true as const,
        alarm_at: new Date(
          pending.start.getTime() - pending.reminderMinutes! * 60 * 1000,
        ).toISOString(),
      }
    : { alarm: false as const, alarm_at: null as null };

  let notificationReady = false;
  let showDeniedGuide = false;

  if (wantsAlarm && !opts?.skipNotificationPrep) {
    if (permission === "denied") {
      showDeniedGuide = true;
    } else if (permission === "default" && opts?.requestPermission) {
      const next = await opts.requestPermission();
      markNotificationOnboardingSeen();
      if (next === "granted") {
        const prep = await ensureNotificationReadyForSave(lang);
        notificationReady = prep.ready;
      } else if (next === "denied") {
        showDeniedGuide = true;
      }
    } else if (permission === "granted") {
      const prep = await ensureNotificationReadyForSave(lang);
      notificationReady = prep.ready;
    }
  }

  let item: ScheduleItem;
  try {
    item = await persist(alarmPayload);
  } catch {
    return {
      ok: false,
      notificationReady: false,
      permission,
      showDeniedGuide,
      errorMessage:
        lang === "ko" ? "일정을 저장하지 못했어요." : "Couldn't save the schedule.",
    };
  }

  if (userId && item.alarm) {
    await syncScheduleReminder(userId, item);
  }

  if (notificationReady && item.alarm) {
    await showScheduleTestNotification(item, lang);
  }

  return {
    ok: true,
    item,
    notificationReady: notificationReady && Boolean(item.alarm),
    permission,
    showDeniedGuide,
    successCopy: buildSaveSuccessCopy(item, lang, {
      notificationReady: notificationReady && Boolean(item.alarm),
    }),
  };
}

export function buildDeniedSaveCopy(lang: "ko" | "en"): {
  headline: string;
  detail: string;
} {
  return {
    headline:
      lang === "ko"
        ? "일정은 저장했지만 알림은 꺼져 있어요."
        : "Schedule saved, but notifications are off.",
    detail:
      lang === "ko"
        ? "알림 켜는 방법 보기"
        : "How to turn notifications on",
  };
}

