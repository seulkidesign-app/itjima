import { supabase } from "@/integrations/supabase/client";
import { registerServiceWorker } from "@/lib/swReminders";
import { wasRecentReminderSyncFailure } from "@/lib/push/scheduledRemindersSync";

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

export type DeviceNotificationTestResult = {
  ok: boolean;
  state: PushSupportState;
  expired?: boolean;
  error?: string;
};

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function detectPlatform(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
}

export function backgroundRemindersVerified(): boolean {
  return import.meta.env.VITE_BACKGROUND_REMINDERS_VERIFIED === "true";
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupportState(): PushSupportState {
  if (typeof window === "undefined") return "unsupported";
  if (detectPlatform() === "ios" && !isStandalonePwa()) {
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

/** Subscribe and persist — caller must ensure Notification.permission === "granted". */
export async function subscribePush(
  userId: string,
): Promise<{ ok: boolean; state: PushSupportState; expired?: boolean }> {
  if (import.meta.env.VITE_E2E === "true") {
    return { ok: false, state: "unsupported" };
  }

  const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY as
    | string
    | undefined;
  if (!vapidPublic) return { ok: false, state: "unsupported" };

  const support = pushSupportState();
  if (support === "unsupported" || support === "not_installed") {
    return { ok: false, state: support };
  }
  if (Notification.permission === "denied") {
    return { ok: false, state: "denied" };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, state: "default" };
  }

  const reg = await getPushRegistration();
  if (!reg) return { ok: false, state: "unsupported" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        vapidPublic,
      ) as BufferSource,
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, state: "expired", expired: true };
  }

  const record: PushSubscriptionRecord = {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    platform: detectPlatform(),
  };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: record.endpoint,
      p256dh: record.p256dh,
      auth: record.auth,
      platform: record.platform,
      revoked_at: null,
      failure_count: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) return { ok: false, state: "expired", expired: true };
  return { ok: true, state: "granted" };
}

/** Verify/resubscribe when permission is already granted — never calls requestPermission. */
export async function ensurePushSubscription(
  userId: string,
): Promise<{ ok: boolean; state: PushSupportState; expired?: boolean }> {
  if (Notification.permission !== "granted") {
    const state = pushSupportState();
    return { ok: false, state: state === "unsupported" ? "unsupported" : state };
  }
  return subscribePush(userId);
}

export async function showLocalTestNotification(): Promise<boolean> {
  if (import.meta.env.VITE_E2E === "true") return false;
  if (typeof window === "undefined" || Notification.permission !== "granted") {
    return false;
  }
  try {
    const reg = await getPushRegistration();
    if (!reg) return false;
    await reg.showNotification("⏰ 잊지마", {
      body: "이 기기에서 알림을 표시할 수 있어요.",
      tag: "itjima-local-display-test",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
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

/** Raw DB check — used by server push diagnostics, not closed-app delivery claims. */
export async function hasStoredPushSubscription(
  userId: string,
): Promise<boolean> {
  if (import.meta.env.VITE_E2E === "true") return false;
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function hasActivePushSubscription(
  userId: string,
): Promise<boolean> {
  if (import.meta.env.VITE_E2E === "true") return false;
  if (!backgroundRemindersVerified()) return false;
  if (wasRecentReminderSyncFailure()) return false;
  return hasStoredPushSubscription(userId);
}
