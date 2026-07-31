import { supabase } from "@/integrations/supabase/client";
import { registerServiceWorker } from "@/lib/swReminders";
import { wasRecentReminderSyncFailure } from "@/lib/push/scheduledRemindersSync";
import {
  logPushDiagnostic,
  logPushFailure,
} from "@/lib/push/pushDiagnostics";
import {
  detectPlatform,
  detectPushPlatform,
  requiresStandalonePwaForPush,
} from "@/lib/push/detectPushPlatform";
import {
  getSessionUserId,
  isDevicePushRegisteredForCurrentUser,
  persistPushSubscriptionViaRpc,
} from "@/lib/push/pushSubscriptionAccount";

export { detectPlatform, detectPushPlatform, requiresStandalonePwaForPush };
export {
  getSessionUserId,
  isDevicePushRegisteredForCurrentUser,
  readBrowserPushRecord,
} from "@/lib/push/pushSubscriptionAccount";

export type PushSupportState =
  | "unsupported"
  | "not_installed"
  | "default"
  | "granted"
  | "denied"
  | "expired";

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
};

export type PushSubscribeResult = {
  ok: boolean;
  state: PushSupportState;
  expired?: boolean;
  error?: string;
  code?: string;
};

export type DeviceNotificationTestResult = PushSubscribeResult;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}


export function backgroundRemindersVerified(): boolean {
  return import.meta.env.VITE_BACKGROUND_REMINDERS_VERIFIED === "true";
}

export function getVapidPublicKey(): string | null {
  const value = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    iosStandalone ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

export function pushSupportState(): PushSupportState {
  if (typeof window === "undefined") return "unsupported";
  if (requiresStandalonePwaForPush() && !isStandalonePwa()) {
    return "not_installed";
  }
  if (!("Notification" in window) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "granted";
  return "default";
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  const reg =
    (await registerServiceWorker()) ??
    (await navigator.serviceWorker.ready.catch(() => null));
  if (!reg?.pushManager) return null;
  return reg;
}

/** Subscribe and persist — always registers for the JWT user via RPC. */
export async function subscribePush(
  userId: string,
): Promise<PushSubscribeResult> {
  if (import.meta.env.VITE_E2E === "true") {
    return { ok: false, state: "unsupported", code: "e2e" };
  }

  const vapidPublic = getVapidPublicKey();
  if (!vapidPublic) {
    logPushFailure("subscribe:vapid_missing");
    return {
      ok: false,
      state: "unsupported",
      code: "missing_vapid",
      error: "VITE_VAPID_PUBLIC_KEY is not configured",
    };
  }

  const support = pushSupportState();
  if (support === "unsupported" || support === "not_installed") {
    logPushFailure("subscribe:support_blocked", { support });
    return { ok: false, state: support };
  }
  if (Notification.permission === "denied") {
    return { ok: false, state: "denied" };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, state: "default" };
  }

  const sessionUserId = await getSessionUserId();
  if (!sessionUserId || sessionUserId !== userId) {
    logPushFailure("subscribe:no_session", { userId: sessionUserId ?? "none" });
    return {
      ok: false,
      state: "expired",
      expired: true,
      code: "not_authenticated",
      error: "No authenticated Supabase session",
    };
  }

  let reg: ServiceWorkerRegistration | null = null;
  try {
    reg = await getPushRegistration();
  } catch (error) {
    logPushFailure("subscribe:service_worker_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      state: "unsupported",
      code: "no_service_worker",
      error: error instanceof Error ? error.message : "service_worker_failed",
    };
  }

  if (!reg) {
    logPushFailure("subscribe:no_registration");
    return {
      ok: false,
      state: "unsupported",
      code: "no_service_worker",
      error: "Service worker registration unavailable",
    };
  }

  let sub: PushSubscription | null = null;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublic,
        ) as BufferSource,
      });
    }
  } catch (error) {
    logPushFailure("subscribe:push_manager_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      state: "expired",
      expired: true,
      code: "subscribe_failed",
      error: error instanceof Error ? error.message : "push_subscribe_failed",
    };
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    logPushFailure("subscribe:invalid_subscription_json");
    return {
      ok: false,
      state: "expired",
      expired: true,
      code: "invalid_subscription",
    };
  }

  const record: PushSubscriptionRecord = {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    platform: detectPushPlatform(),
  };

  logPushDiagnostic("subscribe:register_rpc", {
    userId: sessionUserId,
    platform: record.platform,
    hadExistingBrowserSubscription: Boolean(sub),
  });

  const registered = await persistPushSubscriptionViaRpc(record);
  if (!registered.ok) {
    const code = registered.code ?? "register_failed";
    return {
      ok: false,
      state: "expired",
      expired: true,
      code,
      error: registered.error ?? "push_register_failed",
    };
  }

  logPushDiagnostic("subscribe:register_ok", {
    userId: sessionUserId,
    platform: record.platform,
  });
  return { ok: true, state: "granted" };
}

/** JWT-scoped ensure — never trusts caller user id without session match. */
export async function ensurePushSubscriptionForCurrentUser(): Promise<PushSubscribeResult> {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return {
      ok: false,
      state: "expired",
      expired: true,
      code: "not_authenticated",
      error: "No authenticated Supabase session",
    };
  }
  return ensurePushSubscription(sessionUserId);
}

/** Verify/resubscribe when permission is already granted — never calls requestPermission. */
export async function ensurePushSubscription(
  userId: string,
): Promise<PushSubscribeResult> {
  if (Notification.permission !== "granted") {
    const state = pushSupportState();
    return { ok: false, state: state === "unsupported" ? "unsupported" : state };
  }
  return subscribePush(userId);
}

export async function showLocalTestNotification(): Promise<boolean> {
  if (import.meta.env.VITE_E2E === "true") return false;
  if (detectPushPlatform() === "ios-pwa") return false;
  if (typeof window === "undefined" || Notification.permission !== "granted") {
    return false;
  }
  try {
    const reg = await getPushRegistration();
    if (!reg) return false;
    await reg.showNotification("⏰ 잊지마", {
      body: "이 기기에서 알림을 표시할 수 있어요.",
      tag: "itjima-local-display-test",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifies the device-side notification path only.
 * Does not claim that the scheduled server sender is running.
 */
export async function showDeviceNotificationTest(
  userId: string,
): Promise<DeviceNotificationTestResult> {
  const setup = await ensurePushSubscription(userId);
  if (!setup.ok) return setup;

  const shown = await showLocalTestNotification();
  if (!shown) {
    return { ok: false, state: "expired", expired: true };
  }
  return { ok: true, state: "granted" };
}

/** Immediate authenticated push via test-push Edge Function (legacy diagnostic). */
export async function sendServerPushTest(
  userId: string,
): Promise<DeviceNotificationTestResult> {
  const setup = await ensurePushSubscription(userId);
  if (!setup.ok) return setup;

  try {
    const { data, error } = await supabase.functions.invoke("test-push", {
      body: {},
    });
    if (error) {
      return {
        ok: false,
        state: "expired",
        expired: true,
        error: error.message,
      };
    }
    if (!data?.ok) {
      return {
        ok: false,
        state: "expired",
        expired: true,
        error: typeof data?.error === "string" ? data.error : "push_test_failed",
      };
    }
    return { ok: true, state: "granted" };
  } catch (error) {
    return {
      ok: false,
      state: "expired",
      expired: true,
      error: error instanceof Error ? error.message : "push_test_failed",
    };
  }
}

/** True only when this browser endpoint is actively registered for the user. */
export async function hasStoredPushSubscription(
  userId: string,
): Promise<boolean> {
  if (import.meta.env.VITE_E2E === "true") return false;
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId || sessionUserId !== userId) return false;
  return isDevicePushRegisteredForCurrentUser();
}

export async function hasActivePushSubscription(
  userId: string,
): Promise<boolean> {
  if (import.meta.env.VITE_E2E === "true") return false;
  if (!backgroundRemindersVerified()) return false;
  if (wasRecentReminderSyncFailure()) return false;
  return hasStoredPushSubscription(userId);
}
