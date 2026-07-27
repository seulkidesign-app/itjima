import { supabase } from "@/integrations/supabase/client";
import { resolveUserTimezone } from "@/lib/push/timezone";
import {
  ensurePushSubscription,
  hasStoredPushSubscription,
} from "@/lib/push/pushSubscription";

/**
 * Dedicated scheduled_reminders.schedule_id for server push QA.
 * There is NO FK to schedules.id (see 20260725120000_web_push_reminders.sql).
 * This UUID is never inserted into schedules, so it cannot appear in the UI.
 */
export const SERVER_PUSH_TEST_SCHEDULE_ID =
  "00000000-0000-4000-a000-000000000001";

export const SERVER_PUSH_TEST_DELAY_MS = 60_000;
export const SERVER_PUSH_TEST_POLL_MS = 5_000;
export const SERVER_PUSH_TEST_TIMEOUT_MS = 180_000;
/** pending after due for this long → cron likely not running */
export const SERVER_PUSH_TEST_CRON_STALE_MS = 120_000;
/** Terminal test rows older than this are marked cancelled on cleanup */
export const SERVER_PUSH_TEST_RETENTION_MS = 24 * 60 * 60 * 1000;

export type ServerPushTestStatus =
  | "pending"
  | "processing"
  | "sent"
  | "cancelled"
  | "failed";

export type ServerPushTestRow = {
  id: string;
  status: ServerPushTestStatus;
  attempt_count: number;
  sent_at: string | null;
  updated_at: string;
  due_at_utc: string;
  created_at: string;
};

export type ServerPushTestPhase =
  | "no_permission"
  | "no_login"
  | "no_subscription"
  | "subscription_save_failed"
  | "row_create_failed"
  | "waiting"
  | "sent"
  | "failed"
  | "cron_unknown";

export type ServerPushTestUpsert = {
  user_id: string;
  schedule_id: string;
  due_at_utc: string;
  timezone: string;
  status: "pending";
  idempotency_key: string;
};

const STORAGE_PREFIX = "itjima.serverPushTest.";

let startInFlight: Promise<StartServerPushTestResult> | null = null;

export function isServerPushTestScheduleId(scheduleId: string): boolean {
  return scheduleId === SERVER_PUSH_TEST_SCHEDULE_ID;
}

export function activeServerPushTestStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function persistActiveServerPushTest(userId: string, rowId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(activeServerPushTestStorageKey(userId), rowId);
}

export function readActiveServerPushTestId(userId: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(activeServerPushTestStorageKey(userId));
}

export function clearActiveServerPushTest(userId: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(activeServerPushTestStorageKey(userId));
}

export function serverPushTestIdempotencyKey(
  userId: string,
  dueAtUtc: string,
): string {
  return `push-test:${userId}:${dueAtUtc}`;
}

export function buildServerPushTestUpsert(
  userId: string,
  dueAt: Date = new Date(Date.now() + SERVER_PUSH_TEST_DELAY_MS),
): ServerPushTestUpsert {
  const dueIso = dueAt.toISOString();
  return {
    user_id: userId,
    schedule_id: SERVER_PUSH_TEST_SCHEDULE_ID,
    due_at_utc: dueIso,
    timezone: resolveUserTimezone(),
    status: "pending",
    idempotency_key: serverPushTestIdempotencyKey(userId, dueIso),
  };
}

export function diagnoseServerPushTest(
  row: ServerPushTestRow | null,
  nowMs: number = Date.now(),
): ServerPushTestPhase {
  if (!row) return "waiting";

  if (row.status === "sent") return "sent";
  if (row.status === "failed") return "failed";

  const dueMs = Date.parse(row.due_at_utc);
  const createdMs = Date.parse(row.created_at);
  const elapsedSinceCreate = nowMs - createdMs;

  if (row.status === "pending" || row.status === "processing") {
    if (Number.isFinite(dueMs) && nowMs >= dueMs + SERVER_PUSH_TEST_CRON_STALE_MS) {
      return "cron_unknown";
    }
    if (elapsedSinceCreate >= SERVER_PUSH_TEST_TIMEOUT_MS) {
      return "failed";
    }
    return "waiting";
  }

  return "failed";
}

export function isServerPushTestTerminalPhase(
  phase: ServerPushTestPhase,
): boolean {
  return phase === "sent" || phase === "failed" || phase === "cron_unknown";
}

export function serverPushTestMessage(
  phase: ServerPushTestPhase,
  lang: "ko" | "en",
): string {
  const ko: Record<ServerPushTestPhase, string> = {
    no_permission: "기기에서 알림 권한을 먼저 허용해 주세요.",
    no_login: "서버 테스트는 로그인 후에 할 수 있어요.",
    no_subscription: "푸시 구독이 없어요. 알림 켜기를 먼저 완료해 주세요.",
    subscription_save_failed: "푸시 구독을 저장하지 못했어요.",
    row_create_failed: "예약 테스트를 등록하지 못했어요.",
    waiting: "서버에서 테스트 알림을 보내는 중이에요.",
    sent: "서버에서 테스트 알림을 보냈어요.",
    failed: "서버에서 알림을 보내지 못했어요.",
    cron_unknown: "예약 발송 서버가 아직 실행되지 않았어요.",
  };
  const en: Record<ServerPushTestPhase, string> = {
    no_permission: "Allow notification permission on this device first.",
    no_login: "Sign in to run the server push test.",
    no_subscription: "No push subscription yet. Turn on notifications first.",
    subscription_save_failed: "Couldn't save the push subscription.",
    row_create_failed: "Couldn't register the scheduled test.",
    waiting: "Waiting for the server to send the test notification.",
    sent: "The server sent the test notification.",
    failed: "The server couldn't send the notification.",
    cron_unknown: "The scheduled delivery server doesn't seem to be running yet.",
  };
  return lang === "ko" ? ko[phase] : en[phase];
}

export type StartServerPushTestResult =
  | { ok: true; row: ServerPushTestRow; resumed?: boolean }
  | { ok: false; phase: ServerPushTestPhase };

export async function cancelPendingServerPushTests(
  userId: string,
): Promise<void> {
  if (import.meta.env.VITE_E2E === "true") return;
  await supabase
    .from("scheduled_reminders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("schedule_id", SERVER_PUSH_TEST_SCHEDULE_ID)
    .in("status", ["pending", "processing"]);
}

/** Expire stale in-flight tests and archive old terminal rows (RLS: update only). */
export async function purgeStaleServerPushTests(userId: string): Promise<void> {
  if (import.meta.env.VITE_E2E === "true") return;
  const now = Date.now();
  const staleCutoff = new Date(now - SERVER_PUSH_TEST_TIMEOUT_MS).toISOString();
  const retentionCutoff = new Date(
    now - SERVER_PUSH_TEST_RETENTION_MS,
  ).toISOString();

  await supabase
    .from("scheduled_reminders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("schedule_id", SERVER_PUSH_TEST_SCHEDULE_ID)
    .in("status", ["pending", "processing"])
    .lt("created_at", staleCutoff);

  await supabase
    .from("scheduled_reminders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("schedule_id", SERVER_PUSH_TEST_SCHEDULE_ID)
    .in("status", ["sent", "failed"])
    .lt("updated_at", retentionCutoff);
}

export async function fetchServerPushTestRow(
  userId: string,
  rowId: string,
): Promise<ServerPushTestRow | null> {
  if (import.meta.env.VITE_E2E === "true") return null;
  const { data, error } = await supabase
    .from("scheduled_reminders")
    .select(
      "id, status, attempt_count, sent_at, updated_at, due_at_utc, created_at",
    )
    .eq("user_id", userId)
    .eq("id", rowId)
    .eq("schedule_id", SERVER_PUSH_TEST_SCHEDULE_ID)
    .maybeSingle();

  if (error || !data) return null;
  return data as ServerPushTestRow;
}

/** Latest in-flight test for this user (RLS scopes to auth.uid()). */
export async function fetchLatestActiveServerPushTest(
  userId: string,
): Promise<ServerPushTestRow | null> {
  if (import.meta.env.VITE_E2E === "true") return null;
  const { data, error } = await supabase
    .from("scheduled_reminders")
    .select(
      "id, status, attempt_count, sent_at, updated_at, due_at_utc, created_at",
    )
    .eq("user_id", userId)
    .eq("schedule_id", SERVER_PUSH_TEST_SCHEDULE_ID)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as ServerPushTestRow;
}

export async function startServerPushTest(
  userId: string | null,
): Promise<StartServerPushTestResult> {
  if (startInFlight) return startInFlight;

  startInFlight = startServerPushTestOnce(userId).finally(() => {
    startInFlight = null;
  });

  return startInFlight;
}

async function startServerPushTestOnce(
  userId: string | null,
): Promise<StartServerPushTestResult> {
  if (import.meta.env.VITE_E2E === "true") {
    return { ok: false, phase: "row_create_failed" };
  }

  if (!userId) {
    return { ok: false, phase: "no_login" };
  }

  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return { ok: false, phase: "no_permission" };
  }

  const hasSub = await hasStoredPushSubscription(userId);
  if (!hasSub) {
    return { ok: false, phase: "no_subscription" };
  }

  const push = await ensurePushSubscription(userId);
  if (!push.ok) {
    return { ok: false, phase: "subscription_save_failed" };
  }

  await purgeStaleServerPushTests(userId);

  const storedId = readActiveServerPushTestId(userId);
  if (storedId) {
    const stored = await fetchServerPushTestRow(userId, storedId);
    if (stored && diagnoseServerPushTest(stored) === "waiting") {
      return { ok: true, row: stored, resumed: true };
    }
  }

  const active = await fetchLatestActiveServerPushTest(userId);
  if (active && diagnoseServerPushTest(active) === "waiting") {
    persistActiveServerPushTest(userId, active.id);
    return { ok: true, row: active, resumed: true };
  }

  await cancelPendingServerPushTests(userId);
  const row = buildServerPushTestUpsert(userId);

  const { data, error } = await supabase
    .from("scheduled_reminders")
    .upsert(row, { onConflict: "idempotency_key" })
    .select(
      "id, status, attempt_count, sent_at, updated_at, due_at_utc, created_at",
    )
    .single();

  if (error || !data) {
    return { ok: false, phase: "row_create_failed" };
  }

  persistActiveServerPushTest(userId, data.id);
  return { ok: true, row: data as ServerPushTestRow };
}

export async function finalizeServerPushTestSession(
  userId: string,
  phase: ServerPushTestPhase,
): Promise<void> {
  if (!isServerPushTestTerminalPhase(phase)) return;
  clearActiveServerPushTest(userId);
  await purgeStaleServerPushTests(userId);
}
