import type { PushSubscribeResult, PushSupportState } from "@/lib/push/pushSubscription";
import { detectPushPlatform } from "@/lib/push/detectPushPlatform";

const LOG_PREFIX = "[itjima:push]";

export function logPushDiagnostic(
  step: string,
  detail: Record<string, unknown> = {},
): void {
  if (typeof console === "undefined") return;
  console.info(LOG_PREFIX, step, detail);
}

export function logPushFailure(
  step: string,
  detail: Record<string, unknown> = {},
): void {
  if (typeof console === "undefined") return;
  console.warn(LOG_PREFIX, step, detail);
}

export function describePushFailure(
  result: Pick<PushSubscribeResult, "state" | "error" | "code">,
  lang: "ko" | "en",
): string {
  const ko = lang === "ko";
  switch (result.state) {
    case "not_installed":
      return ko
        ? "아이폰에서는 Safari 탭이 아니라 홈 화면에 추가한 잊지마 앱에서 알림을 켜 주세요."
        : "On iPhone, turn on notifications from the Itjima app on your Home Screen, not Safari.";
    case "denied":
      return ko
        ? "기기 설정에서 알림이 꺼져 있어요."
        : "Notifications are blocked in device settings.";
    case "default":
      return ko
        ? "알림 권한을 먼저 허용해 주세요."
        : "Allow notification permission first.";
    case "unsupported":
      if (result.code === "missing_vapid") {
        return ko
          ? "앱에 VAPID 공개키가 설정되지 않았어요. Vercel Production의 VITE_VAPID_PUBLIC_KEY를 확인해 주세요."
          : "VAPID public key is missing. Check VITE_VAPID_PUBLIC_KEY on Vercel Production.";
      }
      if (result.code === "no_service_worker") {
        return ko
          ? "서비스 워커를 등록하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요."
          : "Couldn't register the service worker. Refresh and try again.";
      }
      return ko
        ? "이 브라우저에서는 Web Push를 지원하지 않아요."
        : "Web Push isn't supported in this browser.";
    case "expired":
      if (result.code === "not_authenticated") {
        return ko
          ? "로그인 세션이 만료됐어요. 다시 로그인한 뒤 시도해 주세요."
          : "Your session expired. Sign in again and retry.";
      }
      if (result.code === "schema_cache") {
        return ko
          ? "서버 스키마 캐시에 push_subscriptions가 없어요. Supabase SQL Editor에서 NOTIFY pgrst, 'reload schema'를 실행해 주세요."
          : "push_subscriptions isn't in the PostgREST schema cache. Run NOTIFY pgrst, 'reload schema' in Supabase.";
      }
      if (result.error) {
        return result.error;
      }
      return ko
        ? "푸시 구독을 저장하지 못했어요."
        : "Couldn't save the push subscription.";
    default:
      return ko
        ? "알림 연결에 실패했어요."
        : "Couldn't connect notifications.";
  }
}

export function summarizePushEnvironment(): Record<string, unknown> {
  if (typeof window === "undefined") return { runtime: "ssr" };

  return {
    permission:
      "Notification" in window ? Notification.permission : "unsupported",
    pushManager: "PushManager" in window,
    serviceWorker: "serviceWorker" in navigator,
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    platform: detectPushPlatform(),
    vapidConfigured: Boolean(
      (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim(),
    ),
  };
}

export type { PushSupportState };
