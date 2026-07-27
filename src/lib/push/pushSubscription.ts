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

export async function ensurePushSubscription(
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

  try {
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        return { ok: false, state: perm === "denied" ? "denied" : "default" };
      }
    } else if (Notification.permission === "denied") {
      return { ok: false, state: "denied" };
    }

    const reg = (await registerServiceWorker()) ??
      (await navigator.serviceWorker.ready.catch(() => null));
    if (!reg?.pushManager) return { ok: false, state: "unsupported" };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
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
  } catch {
    return { ok: false, state: "expired", expired: true };
  }
}

export async function hasActivePushSubscription(
  userId: string,
): Promise<boolean> {
  if (import.meta.env.VITE_E2E === "true") return false;
  // A valid subscription is not enough when the current reminder failed to
  // reach the server. Keep this interaction in honest in-app-only mode.
  if (wasRecentReminderSyncFailure()) return false;

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}
