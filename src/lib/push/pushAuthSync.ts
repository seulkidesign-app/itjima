import { supabase } from "@/integrations/supabase/client";
import { logPushDiagnostic } from "@/lib/push/pushDiagnostics";
import { ensurePushSubscriptionForCurrentUser } from "@/lib/push/pushSubscription";

let installed = false;

/** Re-bind browser push subscriptions to the signed-in user after account switch. */
export function installPushSubscriptionAuthSync(): void {
  if (installed || typeof window === "undefined") return;
  if (import.meta.env.VITE_E2E === "true") return;
  installed = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== "SIGNED_IN" || !session?.user) return;
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    logPushDiagnostic("auth_sync:SIGNED_IN", { userId: session.user.id });
    void ensurePushSubscriptionForCurrentUser();
  });
}
