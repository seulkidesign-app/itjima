import { supabase } from "@/integrations/supabase/client";
import { registerServiceWorker } from "@/lib/swReminders";
import {
  logPushDiagnostic,
  logPushFailure,
} from "@/lib/push/pushDiagnostics";
import { detectPushPlatform } from "@/lib/push/detectPushPlatform";
import type { PushSubscriptionRecord } from "@/lib/push/pushSubscription";

export async function getSessionUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

async function getPushRegistration() {
  const reg =
    (await registerServiceWorker()) ??
    (await navigator.serviceWorker.ready.catch(() => null));
  if (!reg?.pushManager) return null;
  return reg;
}

/** Read the browser push keys without creating a subscription. */
export async function readBrowserPushRecord(): Promise<PushSubscriptionRecord | null> {
  if (typeof window === "undefined" || !("PushManager" in window)) {
    return null;
  }
  try {
    const reg = await getPushRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return null;
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
    return {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      platform: detectPushPlatform(),
    };
  } catch {
    return null;
  }
}

function classifyRpcError(message: string): string {
  if (/not_authenticated/i.test(message)) return "not_authenticated";
  if (/schema cache|PGRST202|PGRST205|Could not find the function/i.test(message)) {
    return "schema_cache";
  }
  if (/JWT|401|403|row-level security|RLS/i.test(message)) {
    return "not_authenticated";
  }
  return "register_failed";
}

export async function persistPushSubscriptionViaRpc(
  record: PushSubscriptionRecord,
): Promise<{ ok: boolean; code?: string; error?: string }> {
  logPushDiagnostic("push_register:rpc_start", {
    platform: record.platform,
  });

  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: record.endpoint,
    p_p256dh: record.p256dh,
    p_auth: record.auth,
    p_platform: record.platform,
  });

  if (error) {
    const code = classifyRpcError(error.message);
    logPushFailure("push_register:rpc_failed", {
      code,
      message: error.message,
    });
    return { ok: false, code, error: error.message };
  }

  logPushDiagnostic("push_register:rpc_ok", {
    platform: record.platform,
  });
  return { ok: true };
}

export async function revokePushSubscriptionViaRpc(
  endpoint: string,
): Promise<{ ok: boolean; code?: string }> {
  logPushDiagnostic("push_revoke:rpc_start", {});

  const { error } = await supabase.rpc("revoke_push_subscription", {
    p_endpoint: endpoint,
  });

  if (error) {
    const code = classifyRpcError(error.message);
    logPushFailure("push_revoke:rpc_failed", { code, message: error.message });
    return { ok: false, code };
  }

  logPushDiagnostic("push_revoke:rpc_ok", {});
  return { ok: true };
}

export async function unsubscribeBrowserPushSubscription(): Promise<boolean> {
  if (typeof window === "undefined" || !("PushManager" in window)) {
    return false;
  }
  try {
    const reg = await getPushRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return true;
    return sub.unsubscribe();
  } catch (error) {
    logPushFailure("push_revoke:browser_unsubscribe_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function disconnectDevicePushForCurrentUser(): Promise<boolean> {
  const record = await readBrowserPushRecord();
  if (record) {
    await revokePushSubscriptionViaRpc(record.endpoint);
  }
  await unsubscribeBrowserPushSubscription();
  return true;
}

export async function isDevicePushRegisteredForCurrentUser(): Promise<boolean> {
  const userId = await getSessionUserId();
  if (!userId) return false;

  const record = await readBrowserPushRecord();
  if (!record) return false;

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("endpoint", record.endpoint)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    logPushFailure("push_register:probe_failed", { message: error.message });
    return false;
  }
  return Boolean(data);
}
