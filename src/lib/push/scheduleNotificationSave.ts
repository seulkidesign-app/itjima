import { readNotificationPermission } from "@/lib/alarmAvailability";
import {
  ensurePushSubscriptionForCurrentUser,
  isDevicePushRegisteredForCurrentUser,
} from "@/lib/push/pushSubscription";
import { buildSaveSuccessCopy } from "@/lib/push/scheduleNotificationContent";
import { syncScheduleReminderDetailed } from "@/lib/push/scheduledRemindersSync";
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
  /** Server queued a future reminder for cron → Web Push. */
  reminderQueued: boolean;
  permission: NotificationPermission | "unsupported";
  showDeniedGuide: boolean;
  /** Show Home Screen install guidance after save (iPhone Safari tab). */
  showInstallGuide?: boolean;
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
  opts?: { needsIosInstall?: boolean },
): boolean {
  if (!isNew || !wantsAlarm || !hasSpecificTime) return false;
  if (hasSeenNotificationOnboarding()) return false;
  // Safari tab: guide install even if Notification.permission looks granted.
  if (opts?.needsIosInstall) return true;
  return readNotificationPermission() === "default";
}

export function buildInstallGuideSaveCopy(lang: "ko" | "en"): {
  headline: string;
  detail: string;
} {
  return {
    headline:
      lang === "ko" ? "일정은 저장했어요." : "Schedule saved.",
    detail:
      lang === "ko"
        ? "닫힌 앱 알림은 홈 화면 앱에서만 켤 수 있어요."
        : "Closed-app alerts only work from the Home Screen app.",
  };
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
      if (next === "granted") {
        const prep = await ensureNotificationReadyForSave(lang);
        notificationReady = prep.ready;
      } else if (next === "denied") {
        showDeniedGuide = true;
      }
      // Only mark seen when push can actually arm — not on a failed Safari-tab try.
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
      reminderQueued: false,
      permission,
      showDeniedGuide,
      errorMessage:
        lang === "ko" ? "일정을 저장하지 못했어요." : "Couldn't save the schedule.",
    };
  }

  let reminderQueued = false;
  if (userId && item.alarm) {
    const sync = await syncScheduleReminderDetailed(userId, item);
    reminderQueued = sync.ok && sync.queued;
    if (!sync.ok) {
      return {
        ok: true,
        item,
        notificationReady: false,
        reminderQueued: false,
        permission,
        showDeniedGuide,
        successCopy: {
          headline:
            lang === "ko" ? "일정은 저장했어요." : "Schedule saved.",
          detail:
            lang === "ko"
              ? "닫힌 앱 알림 예약에 실패했어요. 알림 설정에서 다시 연결해 주세요."
              : "Couldn't queue the closed-app reminder. Reconnect in notification settings.",
        },
      };
    }
    if (sync.reason === "past_due") {
      return {
        ok: true,
        item,
        notificationReady: false,
        reminderQueued: false,
        permission,
        showDeniedGuide,
        successCopy: {
          headline:
            lang === "ko" ? "일정은 저장했어요." : "Schedule saved.",
          detail:
            lang === "ko"
              ? "알림 시간이 이미 지나서 예약하지 않았어요."
              : "The reminder time already passed, so nothing was scheduled.",
        },
      };
    }
  }

  // Never fire the real reminder copy at save time — that looks like the alarm
  // already went off. Due-time delivery is server Web Push + in-app timers only.

  const armed =
    notificationReady &&
    Boolean(item.alarm) &&
    (userId ? reminderQueued : true);

  if (armed) {
    markNotificationOnboardingSeen();
  }

  return {
    ok: true,
    item,
    notificationReady: armed,
    reminderQueued,
    permission,
    showDeniedGuide,
    successCopy: buildSaveSuccessCopy(item, lang, {
      notificationReady: armed,
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

