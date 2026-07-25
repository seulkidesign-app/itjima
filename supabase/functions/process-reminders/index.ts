import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const MAX_ATTEMPTS = 3;
const REVOKE_AFTER_FAILURES = 5;

type ReminderRow = {
  id: string;
  user_id: string;
  schedule_id: string;
  due_at_utc: string;
  attempt_count: number;
};

type PushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

function privacySafePayload(scheduleId: string) {
  return JSON.stringify({
    title: "⏰ 잊지마",
    body: "예정된 일정 알림",
    tag: `schedule-${scheduleId}`,
    data: {
      url: `/schedule?open=${scheduleId}`,
      scheduleId,
    },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const authorized =
    (cronSecret && cronHeader === cronSecret) ||
    authHeader === `Bearer ${serviceKey}`;

  if (!authorized) {
    return json({ error: "unauthorized" }, 401);
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject =
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@itjima.app";

  if (!vapidPublic || !vapidPrivate) {
    return json({ error: "vapid_not_configured" }, 503);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
  );

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_due_reminders",
    { p_batch_size: 50 },
  );

  if (claimError) {
    return json({ error: claimError.message }, 500);
  }

  const reminders = (claimed ?? []) as ReminderRow[];
  let sent = 0;
  let failed = 0;

  for (const reminder of reminders) {
    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, failure_count")
      .eq("user_id", reminder.user_id)
      .is("revoked_at", null);

    if (subsError || !subs?.length) {
      await supabase
        .from("scheduled_reminders")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);
      failed += 1;
      continue;
    }

    const payload = privacySafePayload(reminder.schedule_id);
    let anySuccess = false;
    let hardFail = false;

    for (const sub of subs as PushRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 86400 },
        );
        anySuccess = true;
        await supabase
          .from("push_subscriptions")
          .update({
            last_success_at: new Date().toISOString(),
            failure_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        const nextFailures = sub.failure_count + 1;
        const revoke =
          statusCode === 404 ||
          statusCode === 410 ||
          nextFailures >= REVOKE_AFTER_FAILURES;

        await supabase
          .from("push_subscriptions")
          .update({
            failure_count: nextFailures,
            revoked_at: revoke ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);

        if (statusCode === 404 || statusCode === 410) hardFail = true;
      }
    }

    if (anySuccess) {
      await supabase
        .from("scheduled_reminders")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);
      sent += 1;
    } else if (
      reminder.attempt_count >= MAX_ATTEMPTS ||
      hardFail
    ) {
      await supabase
        .from("scheduled_reminders")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);
      failed += 1;
    } else {
      await supabase
        .from("scheduled_reminders")
        .update({
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);
      failed += 1;
    }
  }

  return json({
    claimed: reminders.length,
    sent,
    failed,
  });
});
