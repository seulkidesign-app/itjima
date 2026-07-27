import type { PushSupportState } from "@/lib/push/pushSubscription";
import { isStandalonePwa } from "@/lib/push/pushSubscription";

export type NotificationPermissionState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export type AlarmSheetView =
  | "ios_install"
  | "default"
  | "granted"
  | "denied"
  | "unsupported";

/** Fresh read — call each time the alarm sheet opens. */
export function readNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** iPhone Safari tab (not home-screen standalone PWA). */
export function isIosSafariTab(): boolean {
  return isIosDevice() && !isStandalonePwa();
}

export function resolveAlarmSheetView(
  permission: NotificationPermissionState,
  iosSafariTab: boolean,
): AlarmSheetView {
  if (iosSafariTab) return "ios_install";
  if (permission === "unsupported") return "unsupported";
  if (permission === "denied") return "denied";
  if (permission === "granted") return "granted";
  return "default";
}

/** Presets are shown only after permission is granted and local push is ready. */
export function canSelectAlarmPresets(
  view: AlarmSheetView,
  pushReady: boolean,
): boolean {
  return view === "granted" && pushReady;
}

/** Whether Notification.requestPermission may be invoked (explicit user gesture). */
export function canRequestNotificationPermission(view: AlarmSheetView): boolean {
  return view === "default";
}

export function alarmAvailabilityHint(
  state: PushSupportState,
  signedIn: boolean,
  lang: "ko" | "en",
  backgroundVerified = false,
): string {
  if (!signedIn) {
    return lang === "en"
      ? "For now, alarms work while the app is open. Sign in to keep your schedules across devices."
      : "지금은 앱을 열어둔 동안 알려드려요. 로그인하면 일정을 다른 기기에서도 이어갈 수 있어요.";
  }

  if (state === "not_installed") {
    return lang === "en"
      ? "On iPhone, add Itjima to your Home Screen before testing closed-app alerts."
      : "아이폰에서는 홈 화면에 추가한 뒤 닫힌 앱 알림을 테스트할 수 있어요.";
  }

  if (state === "denied") {
    return lang === "en"
      ? "Notifications are off in device settings. The schedule will still be saved."
      : "기기 설정에서 알림이 꺼져 있어요. 일정은 그대로 저장돼요.";
  }

  if (state === "unsupported" || state === "expired") {
    return lang === "en"
      ? "This device may only alert you while the app is open."
      : "이 기기에서는 앱을 열어둔 동안에만 알려드릴 수 있어요.";
  }

  if (state === "granted" && backgroundVerified) {
    return lang === "en"
      ? "Closed-app alerts have been verified for this release."
      : "이번 버전은 앱을 닫은 뒤 알림까지 검증됐어요.";
  }

  if (state === "granted") {
    return lang === "en"
      ? "Alerts work while the app is open. Closed-app delivery is still being verified."
      : "앱을 열어둔 동안 알려드려요. 닫힌 앱 알림은 실제 기기에서 검증 중이에요.";
  }

  return lang === "en"
    ? "We'll ask for notification permission when you set an alarm."
    : "알림을 설정할 때 기기 권한을 요청해요.";
}
