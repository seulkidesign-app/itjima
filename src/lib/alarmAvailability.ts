import type { PushSupportState } from "@/lib/push/pushSubscription";

export function alarmAvailabilityHint(
  state: PushSupportState,
  signedIn: boolean,
  lang: "ko" | "en",
): string {
  if (!signedIn) {
    return lang === "en"
      ? "For now, alarms work while the app is open. Sign in to set background alerts."
      : "지금은 앱을 열어둔 동안 알려드려요. 로그인하면 백그라운드 알림을 설정할 수 있어요.";
  }

  if (state === "not_installed") {
    return lang === "en"
      ? "On iPhone, add Itjima to your Home Screen to receive alerts after closing it."
      : "아이폰에서는 홈 화면에 추가해야 앱을 닫은 뒤에도 알림을 받을 수 있어요.";
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

  if (state === "granted") {
    return lang === "en"
      ? "We'll verify the alert and, when supported, notify you even after the app closes."
      : "알림 예약을 확인한 뒤, 지원되는 기기에서는 앱을 닫아도 알려드려요.";
  }

  return lang === "en"
    ? "We'll ask for notification permission when you set an alarm."
    : "알림을 설정할 때 기기 권한을 요청해요.";
}
