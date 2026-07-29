import { supabase } from "@/integrations/supabase/client";
import { authDebugSignOut } from "@/lib/authDebug";
import { logPushDiagnostic, logPushFailure } from "@/lib/push/pushDiagnostics";
import {
  readBrowserPushRecord,
  revokePushSubscriptionViaRpc,
  unsubscribeBrowserPushSubscription,
} from "@/lib/push/pushSubscriptionAccount";

/** Revoke server + browser push state before auth sign-out. */
export async function revokePushBeforeSignOut(): Promise<void> {
  const record = await readBrowserPushRecord();
  if (record) {
    const revoked = await revokePushSubscriptionViaRpc(record.endpoint);
    if (!revoked.ok) {
      logPushFailure("signout:server_revoke_failed", { code: revoked.code });
    }
  } else {
    logPushDiagnostic("signout:no_browser_subscription", {});
  }

  const unsubscribed = await unsubscribeBrowserPushSubscription();
  if (!unsubscribed) {
    logPushFailure("signout:browser_unsubscribe_failed", {});
  }
}

export async function signOutWithPushCleanup(
  source: string,
): Promise<{ error: Error | null }> {
  authDebugSignOut(source);
  await revokePushBeforeSignOut();
  const { error } = await supabase.auth.signOut();
  if (error) {
    logPushFailure("signout:auth_failed", { message: error.message });
    return { error };
  }
  return { error: null };
}
