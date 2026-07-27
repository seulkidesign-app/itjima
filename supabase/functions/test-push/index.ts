import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject =
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@itjima.app";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "supabase_not_configured" }, 503);
  }
  if (!vapidPublic || !vapidPrivate) {
    return json({ error: "vapid_not_configured" }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("user_id", userData.user.id)
    .is("revoked_at", null);

  if (subscriptionsError) {
    return json({ error: "subscription_lookup_failed" }, 500);
  }
  if (!subscriptions?.length) {
    return json({ error: "subscription_missing" }, 409);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const payload = JSON.stringify({
    title: "🔔 잊지마 알림 테스트",
    body: "서버에서 보낸 알림이 정상적으로 도착했어요.",
    tag: `itjima-test-${Date.now()}`,
    data: { url: "/schedule", test: true },
  });

  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions as PushRow[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload,
        { TTL: 60 },
      );
      sent += 1;
      await admin
        .from("push_subscriptions")
        .update({
          last_success_at: new Date().toISOString(),
          failure_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);
    } catch (error) {
      failed += 1;
      const statusCode = (error as { statusCode?: number }).statusCode;
      const nextFailures = (subscription.failure_count ?? 0) + 1;
      const revoked = statusCode === 404 || statusCode === 410;
      await admin
        .from("push_subscriptions")
        .update({
          failure_count: nextFailures,
          revoked_at: revoked ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);
    }
  }

  if (!sent) {
    return json({ error: "push_delivery_failed", sent, failed }, 502);
  }

  return json({ ok: true, sent, failed });
});
