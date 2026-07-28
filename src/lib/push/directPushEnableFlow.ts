import { supabase } from "@/integrations/supabase/client";
import { registerServiceWorker } from "@/lib/swReminders";
import {
  logPushDiagnostic,
  logPushFailure,
} from "@/lib/push/pushDiagnostics";
import {
  detectPlatform,
  getVapidPublicKey,
  isStandalonePwa,
  requiresStandalonePwaForPush,
  type PushSubscribeResult,
} from "@/lib/push/pushSubscription";

export type PushEnableStep = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type DirectPushEnableResult = {
  ok: boolean;
  pushSubscribed: boolean;
  permission: NotificationPermission | "unsupported";
  steps: PushEnableStep[];
  subscribe?: PushSubscribeResult;
  errorMessage?: string;
};

function step(
  id: string,
  label: string,
  ok: boolean,
  detail: string,
): PushEnableStep {
  const entry = { id, label, ok, detail };
  logPushDiagnostic(`direct_enable:${id}`, { ok, detail: redactStepDetail(detail) });
  return entry;
}

function redactStepDetail(detail: string): string {
  if (/endpoint/i.test(detail) || /^https?:\/\//.test(detail)) {
    return "[redacted]";
  }
  return detail;
}

function readPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function standaloneDetail(): string {
  if (typeof window === "undefined") return "window unavailable";
  const displayStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const displayFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return JSON.stringify({
    displayStandalone,
    displayFullscreen,
    iosStandalone,
    resolved: isStandalonePwa(),
  });
}

/**
 * Runs inside a button click handler.
 * The first await MUST be Notification.requestPermission() when permission is default.
 * Do not setState, navigate, or open modals before that call on iOS.
 */
export async function executeDirectPushEnableFlow(
  userId: string,
  lang: "ko" | "en",
): Promise<DirectPushEnableResult> {
  const steps: PushEnableStep[] = [];
  const ko = lang === "ko";

  if (!userId) {
    return {
      ok: false,
      pushSubscribed: false,
      permission: readPermission(),
      steps: [
        step(
          "login",
          ko ? "로그인" : "Sign in",
          false,
          ko ? "userId 없음" : "missing userId",
        ),
      ],
      errorMessage: ko
        ? "알림을 켜려면 먼저 로그인해 주세요."
        : "Sign in first to turn on notifications.",
    };
  }

  const platform = detectPlatform();
  const standalone = isStandalonePwa();
  const standaloneRequired = requiresStandalonePwaForPush();
  steps.push(
    step(
      "standalone",
      ko ? "PWA standalone" : "PWA standalone",
      !standaloneRequired || standalone,
      standaloneRequired
        ? standaloneDetail()
        : ko
          ? "iOS/iPadOS만 홈 화면 설치 필요"
          : "not required on this platform",
    ),
  );

  if (standaloneRequired && !standalone) {
    return {
      ok: false,
      pushSubscribed: false,
      permission: readPermission(),
      steps,
      errorMessage: ko
        ? "아이폰 Safari 탭이 아니라 홈 화면에 추가한 잊지마 앱에서 눌러 주세요."
        : "Use the Itjima app from your Home Screen, not an iPhone Safari tab.",
    };
  }

  if (!("Notification" in window)) {
    steps.push(
      step(
        "notification_api",
        "Notification API",
        false,
        "unsupported",
      ),
    );
    return {
      ok: false,
      pushSubscribed: false,
      permission: "unsupported",
      steps,
      errorMessage: ko
        ? "이 브라우저는 Notification API를 지원하지 않아요."
        : "This browser does not support the Notification API.",
    };
  }

  let permission = Notification.permission;
  steps.push(
    step(
      "permission_before",
      ko ? "현재 권한" : "Current permission",
      true,
      permission,
    ),
  );

  if (permission === "default") {
    permission = await Notification.requestPermission();
    steps.push(
      step(
        "request_permission",
        ko ? "권한 요청 결과" : "Permission request result",
        permission === "granted",
        permission,
      ),
    );
  } else {
    steps.push(
      step(
        "request_permission",
        ko ? "권한 요청" : "Permission request",
        true,
        ko
          ? `이미 ${permission} — requestPermission() 생략`
          : `already ${permission} — skipped requestPermission()`,
      ),
    );
  }

  if (permission === "denied") {
    return {
      ok: false,
      pushSubscribed: false,
      permission,
      steps,
      errorMessage: ko
        ? "알림이 거부됐어요. iPhone 설정 → 알림 → 잊지마에서 허용해 주세요."
        : "Notifications are denied. Allow them in iPhone Settings → Notifications → Itjima.",
    };
  }

  if (permission !== "granted") {
    return {
      ok: false,
      pushSubscribed: false,
      permission,
      steps,
      errorMessage: ko
        ? "알림 권한을 허용하지 않았어요."
        : "Notification permission was not granted.",
    };
  }

  if (!("PushManager" in window)) {
    steps.push(
      step("push_manager", "PushManager", false, "unsupported"),
    );
    return {
      ok: false,
      pushSubscribed: false,
      permission,
      steps,
      errorMessage: ko
        ? "이 기기는 Web Push(PushManager)를 지원하지 않아요."
        : "Web Push (PushManager) is not supported on this device.",
    };
  }

  const vapid = getVapidPublicKey();
  steps.push(
    step(
      "vapid",
      "VITE_VAPID_PUBLIC_KEY",
      Boolean(vapid),
      vapid ? "configured" : "missing",
    ),
  );
  if (!vapid) {
    return {
      ok: false,
      pushSubscribed: false,
      permission,
      steps,
      errorMessage: ko
        ? "VITE_VAPID_PUBLIC_KEY가 없어요."
        : "VITE_VAPID_PUBLIC_KEY is missing.",
    };
  }

  let registration: ServiceWorkerRegistration | null = null;
  try {
    registration =
      (await registerServiceWorker()) ??
      (await navigator.serviceWorker.ready);
    steps.push(
      step(
        "service_worker_ready",
        ko ? "Service Worker" : "Service Worker",
        Boolean(registration?.active ?? registration?.installing ?? registration?.waiting),
        registration
          ? `scope=${registration.scope}`
          : "no registration",
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logPushFailure("direct_enable:service_worker", { message });
    steps.push(
      step("service_worker_ready", "Service Worker", false, message),
    );
    return {
      ok: false,
      pushSubscribed: false,
      permission,
      steps,
      errorMessage: ko
        ? "서비스 워커를 준비하지 못했어요."
        : "Couldn't prepare the service worker.",
    };
  }

  if (!registration?.pushManager) {
    steps.push(
      step("push_manager", "pushManager", false, "missing on registration"),
    );
    return {
      ok: false,
      pushSubscribed: false,
      permission,
      steps,
      errorMessage: ko
        ? "pushManager를 사용할 수 없어요."
        : "pushManager is unavailable.",
    };
  }

  let existing = await registration.pushManager.getSubscription();
  steps.push(
    step(
      "get_subscription",
      ko ? "기존 구독" : "Existing subscription",
      true,
      existing ? (ko ? "있음" : "present") : (ko ? "없음" : "none"),
    ),
  );

  if (!existing) {
    try {
      const keyBytes = Uint8Array.from(
        atob(
          (vapid + "=".repeat((4 - (vapid.length % 4)) % 4))
            .replace(/-/g, "+")
            .replace(/_/g, "/"),
        ),
        (c) => c.charCodeAt(0),
      );
      existing = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes,
      });
      steps.push(
        step(
          "subscribe",
          ko ? "pushManager.subscribe" : "pushManager.subscribe",
          true,
          ko ? "생성됨" : "created",
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logPushFailure("direct_enable:subscribe", { message });
      steps.push(
        step("subscribe", "pushManager.subscribe", false, message),
      );
      return {
        ok: false,
        pushSubscribed: false,
        permission,
        steps,
        errorMessage: ko
          ? `푸시 구독 실패: ${message}`
          : `Push subscribe failed: ${message}`,
      };
    }
  }

  const json = existing.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    steps.push(
      step(
        "subscription_json",
        ko ? "구독 키" : "Subscription keys",
        false,
        "missing endpoint or keys",
      ),
    );
    return {
      ok: false,
      pushSubscribed: false,
      permission,
      steps,
      errorMessage: ko
        ? "구독 정보가 올바르지 않아요."
        : "Subscription payload is invalid.",
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  steps.push(
    step(
      "auth_session",
      ko ? "로그인 세션" : "Auth session",
      Boolean(session?.user?.id === userId),
      session?.user?.id ? (ko ? "확인됨" : "verified") : (ko ? "없음" : "none"),
    ),
  );
  if (!session?.user?.id || session.user.id !== userId) {
    return {
      ok: false,
      pushSubscribed: false,
      permission,
      steps,
      errorMessage: ko
        ? "로그인 세션이 없어요. 다시 로그인해 주세요."
        : "No auth session. Sign in again.",
    };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      platform: detectPlatform(),
      revoked_at: null,
      failure_count: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) {
    logPushFailure("direct_enable:upsert", {
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    steps.push(
      step(
        "upsert",
        ko ? "DB 저장" : "DB upsert",
        false,
        error.message,
      ),
    );
    return {
      ok: false,
      pushSubscribed: false,
      permission,
      steps,
      subscribe: {
        ok: false,
        state: "expired",
        code: /schema cache|PGRST205/i.test(error.message)
          ? "schema_cache"
          : "upsert_failed",
        error: error.message,
      },
      errorMessage: error.message,
    };
  }

  steps.push(
    step(
      "upsert",
      ko ? "DB 저장" : "DB upsert",
      true,
      ko ? "저장됨" : "saved",
    ),
  );

  return {
    ok: true,
    pushSubscribed: true,
    permission,
    steps,
  };
}
