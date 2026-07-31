import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const MAX_ATTEMPTS = 5;
const REVOKE_AFTER_FAILURES = 5;
const SERVER_PUSH_TEST_SCHEDULE_ID =
  "00000000-0000-4000-a000-000000000001";
/** Skip re-push if this subscription already succeeded at/after due time. */
const ALREADY_DELIVERED_SLACK_MS = 5_000;
// Keep in sync with src/lib/push/reminderDelivery.ts

type ReminderRow = {
  id: string;
  user_id: string;
  schedule_id: string;
  due_at_utc: string;
  timezone: string | null;
  attempt_count: number;
};

type PushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
  platform: string | null;
  last_success_at: string | null;
};

type DeliveryResult = {
  platform: string;
  attempted: boolean;
  accepted: boolean;
  skipped: boolean;
  statusCode: number | null;
  errorType: string | null;
};

function assertRelativeAppUrl(url: string): string {
  if (!url.startsWith("/") || url.startsWith("//")) {
    throw new Error("external_notification_url_blocked");
  }
  return url;
}

type ScheduleRow = {
  id: string;
  text: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean | null;
  start_all_day: boolean | null;
  end_all_day: boolean | null;
  alarm: boolean | null;
  alarm_at: string | null;
};

/** Format in the user's timezone — Deno/UTC getHours() would show 11:00 for 20:00 KST. */
function formatTimeInZone(iso: string, timeZone: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const tz = timeZone && timeZone.trim() ? timeZone : "Asia/Seoul";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }
}

function resolveAllDay(schedule: ScheduleRow): boolean {
  if (schedule.start_all_day != null || schedule.end_all_day != null) {
    return Boolean(schedule.start_all_day && schedule.end_all_day);
  }
  return Boolean(schedule.all_day);
}

function buildReminderPayload(
  scheduleId: string,
  schedule: ScheduleRow | null,
  timeZone: string | null,
): string {
  const isTest = scheduleId === SERVER_PUSH_TEST_SCHEDULE_ID;
  if (isTest) {
    return JSON.stringify({
      title: "잊지마",
      body: "서버 예약 알림 테스트",
      tag: "itjima-server-push-test",
      data: {
        url: assertRelativeAppUrl("/schedule"),
        scheduleId,
      },
    });
  }

  const title = (schedule?.text ?? "").trim() || "잊지마";
  let body = "예정된 일정이에요.";
  if (schedule && !resolveAllDay(schedule)) {
    const timeLabel = formatTimeInZone(schedule.start_time, timeZone);
    if (timeLabel) {
      body = `${timeLabel} 일정이에요.`;
    }
  }

  return JSON.stringify({
    title,
    body,
    tag: `schedule-${scheduleId}`,
    data: {
      url: assertRelativeAppUrl(`/schedule?open=${scheduleId}`),
      scheduleId,
    },
  });
}

function classifyPushError(error: unknown): {
  statusCode: number | null;
  errorType: string;
} {
  const statusCode = (error as { statusCode?: number }).statusCode ?? null;
  let errorType = "unknown";
  if (statusCode === 404) errorType = "subscription_gone";
  else if (statusCode === 410) errorType = "subscription_expired";
  else if (statusCode === 401 || statusCode === 403) errorType = "push_auth_rejected";
  else if (statusCode === 413) errorType = "payload_too_large";
  else if (statusCode === 429) errorType = "rate_limited";
  else if (statusCode != null && statusCode >= 500) errorType = "push_service_error";
  return { statusCode, errorType };
}

/** True if this device already got a push for this reminder's due window. */
function subscriptionAlreadyDelivered(
  lastSuccessAt: string | null | undefined,
  dueAtUtc: string,
): boolean {
  if (!lastSuccessAt) return false;
  const successMs = Date.parse(lastSuccessAt);
  const dueMs = Date.parse(dueAtUtc);
  if (!Number.isFinite(successMs) || !Number.isFinite(dueMs)) return false;
  return successMs >= dueMs - ALREADY_DELIVERED_SLACK_MS;
}

function shouldMarkReminderSent(
  coveredCount: number,
  activeSubscriptionCount: number,
  attemptCount: number,
): boolean {
  if (activeSubscriptionCount <= 0) return false;
  if (coveredCount >= activeSubscriptionCount) return true;
  return attemptCount >= MAX_ATTEMPTS && coveredCount > 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Validate pg_cron caller before any database access. */
function rejectUnlessCronAuthorized(req: Request): Response | null {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");

  if (!cronHeader) {
    return json({ error: "unauthorized" }, 401);
  }

  if (!cronSecret || cronHeader !== cronSecret) {
    return json({ error: "unauthorized" }, 401);
  }

  return null;
}

Deno.serve(async (req) => {
  const authFailure = rejectUnlessCronAuthorized(req);
  if (authFailure) return authFailure;

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject =
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@itjima.app";

  if (!vapidPublic || !vapidPrivate) {
    return json({ error: "vapid_not_configured" }, 503);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
  let partialRetry = 0;
  const reminderDeliveries: Array<{
    reminderId: string;
    scheduleId: string;
    deliveries: DeliveryResult[];
    reminderMarkedSent: boolean;
    allDevicesCovered: boolean;
  }> = [];

  for (const reminder of reminders) {
    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select(
        "id, endpoint, p256dh, auth, failure_count, platform, last_success_at",
      )
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

    const { data: schedule } = await supabase
      .from("schedules")
      .select(
        "id, text, start_time, end_time, all_day, start_all_day, end_all_day, alarm, alarm_at",
      )
      .eq("id", reminder.schedule_id)
      .maybeSingle();

    const payload = buildReminderPayload(
      reminder.schedule_id,
      (schedule as ScheduleRow | null) ?? null,
      reminder.timezone,
    );
    const deliveries: DeliveryResult[] = [];
    let coveredCount = 0;
    let attemptedThisRun = 0;
    let acceptedThisRun = 0;

    for (const sub of subs as PushRow[]) {
      const platform = sub.platform ?? "unknown";

      if (subscriptionAlreadyDelivered(sub.last_success_at, reminder.due_at_utc)) {
        deliveries.push({
          platform,
          attempted: false,
          accepted: true,
          skipped: true,
          statusCode: null,
          errorType: "already_delivered",
        });
        coveredCount += 1;
        console.info("[process-reminders] delivery", {
          scheduleId: reminder.schedule_id,
          platform,
          accepted: true,
          skipped: true,
        });
        continue;
      }

      const delivery: DeliveryResult = {
        platform,
        attempted: true,
        accepted: false,
        skipped: false,
        statusCode: null,
        errorType: null,
      };
      attemptedThisRun += 1;

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 86400 },
        );
        delivery.accepted = true;
        delivery.statusCode = 201;
        coveredCount += 1;
        acceptedThisRun += 1;
        await supabase
          .from("push_subscriptions")
          .update({
            last_success_at: new Date().toISOString(),
            failure_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
      } catch (err) {
        const classified = classifyPushError(err);
        delivery.statusCode = classified.statusCode;
        delivery.errorType = classified.errorType;

        const statusCode = classified.statusCode;
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

        // Gone/expired subscription is no longer an active target.
        if (revoke) {
          coveredCount += 1;
        }
      }

      deliveries.push(delivery);
      console.info("[process-reminders] delivery", {
        scheduleId: reminder.schedule_id,
        platform,
        accepted: delivery.accepted,
        statusCode: delivery.statusCode,
        errorType: delivery.errorType,
      });
    }

    const activeCount = (subs as PushRow[]).length;
    const allDevicesCovered = coveredCount >= activeCount;
    const reminderMarkedSent = shouldMarkReminderSent(
      coveredCount,
      activeCount,
      reminder.attempt_count,
    );

    reminderDeliveries.push({
      reminderId: reminder.id,
      scheduleId: reminder.schedule_id,
      deliveries,
      reminderMarkedSent,
      allDevicesCovered,
    });

    if (reminderMarkedSent) {
      await supabase
        .from("scheduled_reminders")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);
      sent += 1;
    } else if (reminder.attempt_count >= MAX_ATTEMPTS) {
      await supabase
        .from("scheduled_reminders")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);
      failed += 1;
    } else {
      // Keep pending so cron retries devices that have not accepted yet.
      await supabase
        .from("scheduled_reminders")
        .update({
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);
      if (acceptedThisRun > 0 || attemptedThisRun > 0) {
        partialRetry += 1;
      } else {
        failed += 1;
      }
    }
  }

  return json({
    claimed: reminders.length,
    sent,
    failed,
    partialRetry,
    reminders: reminderDeliveries,
  });
});
