import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const IOS_PWA_PLATFORM = "ios-pwa";
const REVOKE_AFTER_FAILURES = 5;
const SERVER_PUSH_TEST_SCHEDULE_ID =
  "00000000-0000-4000-a000-000000000001";
const IOS_SCHEDULED_TEST_DELAY_MS = 3 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type PushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
  platform: string | null;
};

type DeliveryResult = {
  platform: string;
  attempted: boolean;
  accepted: boolean;
  statusCode: number | null;
  errorType: string | null;
  errorMessage: string | null;
  deliveryId?: string;
  serverSentAt?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeErrorMessage(raw: string): string {
  return raw
    .replace(/https?:\/\/[^\s]+/g, "[redacted]")
    .replace(/[A-Za-z0-9+/=_-]{32,}/g, "[redacted]")
    .slice(0, 120);
}

function classifyPushError(error: unknown): {
  statusCode: number | null;
  errorType: string;
  errorMessage: string;
} {
  const statusCode = (error as { statusCode?: number }).statusCode ?? null;
  let errorType = "unknown";
  if (statusCode === 404) errorType = "subscription_gone";
  else if (statusCode === 410) errorType = "subscription_expired";
  else if (statusCode === 401 || statusCode === 403) errorType = "push_auth_rejected";
  else if (statusCode === 413) errorType = "payload_too_large";
  else if (statusCode === 429) errorType = "rate_limited";
  else if (statusCode != null && statusCode >= 500) errorType = "push_service_error";

  const raw = error instanceof Error ? error.message : String(error);
  return {
    statusCode,
    errorType,
    errorMessage: sanitizeErrorMessage(raw),
  };
}

function buildDiagnosticPayload(
  title: string,
  body: string,
  deliveryId: string,
  serverSentAt: string,
  tag: string,
) {
  return JSON.stringify({
    title,
    body,
    tag,
    data: {
      url: "/schedule",
      source: "server-web-push",
      deliveryId,
      serverSentAt,
    },
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

  let includeScheduledTest = false;
  try {
    const body = await req.json().catch(() => ({}));
    includeScheduledTest = Boolean(body?.includeScheduledTest);
  } catch {
    // default immediate only
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
    .select("id, endpoint, p256dh, auth, failure_count, platform")
    .eq("user_id", userData.user.id)
    .eq("platform", IOS_PWA_PLATFORM)
    .is("revoked_at", null);

  if (subscriptionsError) {
    return json({ error: "subscription_lookup_failed" }, 500);
  }

  const iosSubs = (subscriptions ?? []) as PushRow[];
  if (!iosSubs.length) {
    return json({
      ok: false,
      error: "ios_pwa_subscription_missing",
      deliveries: [] as DeliveryResult[],
    }, 409);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const deliveryId = crypto.randomUUID();
  const serverSentAt = new Date().toISOString();
  const payload = buildDiagnosticPayload(
    "잊지마 알림 테스트",
    "아이폰 알림 연결이 완료됐어요.",
    deliveryId,
    serverSentAt,
    `ios-test-${deliveryId.slice(0, 8)}`,
  );

  const deliveries: DeliveryResult[] = [];
  let acceptedCount = 0;

  for (const subscription of iosSubs) {
    const platform = subscription.platform ?? IOS_PWA_PLATFORM;
    const result: DeliveryResult = {
      platform,
      attempted: true,
      accepted: false,
      statusCode: null,
      errorType: null,
      errorMessage: null,
      deliveryId,
      serverSentAt,
    };

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
        { TTL: 86400 },
      );
      result.accepted = true;
      result.statusCode = 201;
      acceptedCount += 1;
      await admin
        .from("push_subscriptions")
        .update({
          last_success_at: serverSentAt,
          failure_count: 0,
          updated_at: serverSentAt,
        })
        .eq("id", subscription.id);

      console.info("[test-push-ios] delivery_ok", {
        platform,
        accepted: true,
        statusCode: 201,
        deliveryId: deliveryId.slice(0, 8),
        serverSentAt,
      });
    } catch (error) {
      const classified = classifyPushError(error);
      result.statusCode = classified.statusCode;
      result.errorType = classified.errorType;
      result.errorMessage = classified.errorMessage;

      const nextFailures = (subscription.failure_count ?? 0) + 1;
      const revoked =
        classified.statusCode === 404 ||
        classified.statusCode === 410 ||
        nextFailures >= REVOKE_AFTER_FAILURES;

      await admin
        .from("push_subscriptions")
        .update({
          failure_count: nextFailures,
          revoked_at: revoked ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      console.warn("[test-push-ios] delivery_failed", {
        platform,
        statusCode: classified.statusCode,
        errorType: classified.errorType,
      });
    }

    deliveries.push(result);
  }

  let scheduledReminder: {
    due_at_utc: string;
    idempotency_key: string;
  } | null = null;

  if (includeScheduledTest && acceptedCount > 0) {
    const dueAt = new Date(Date.now() + IOS_SCHEDULED_TEST_DELAY_MS);
    const dueIso = dueAt.toISOString();
    const idempotencyKey =
      `push-test-ios:${userData.user.id}:${dueIso}`;
    scheduledReminder = {
      due_at_utc: dueIso,
      idempotency_key: idempotencyKey,
    };

    await admin.from("scheduled_reminders").upsert(
      {
        user_id: userData.user.id,
        schedule_id: SERVER_PUSH_TEST_SCHEDULE_ID,
        due_at_utc: dueIso,
        timezone: "UTC",
        status: "pending",
        idempotency_key: idempotencyKey,
      },
      { onConflict: "idempotency_key" },
    );
  }

  if (!acceptedCount) {
    return json({
      ok: false,
      error: "ios_push_delivery_failed",
      deliveries,
      scheduledReminder,
    }, 502);
  }

  return json({
    ok: true,
    accepted: acceptedCount,
    attempted: deliveries.length,
    deliveries,
    deliveryId,
    serverSentAt,
    scheduledReminder,
  });
});
