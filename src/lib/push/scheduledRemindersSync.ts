import { supabase } from "@/integrations/supabase/client";
import type { ScheduleItem } from "@/lib/store";
import { reminderIdempotencyKey } from "@/lib/push/reminderPayload";
import { resolveUserTimezone } from "@/lib/push/timezone";
import { effectiveAlarmAt } from "@/lib/scheduleReminders";

export type ScheduledReminderUpsert = {
  user_id: string;
  schedule_id: string;
  due_at_utc: string;
  timezone: string;
  status: "pending";
  idempotency_key: string;
};

const SYNC_STATE_KEY = "itjima.reminder.serverSync";
const FAILURE_WINDOW_MS = 30_000;
let memorySyncState: { ok: boolean; at: number } | null = null;

export function rememberReminderSyncResult(ok: boolean, at = Date.now()) {
  memorySyncState = { ok, at };
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SYNC_STATE_KEY, JSON.stringify(memorySyncState));
  } catch {
    // Memory state is enough for the current interaction.
  }
}

function readSyncState(): { ok: boolean; at: number } | null {
  if (memorySyncState) return memorySyncState;
  if (typeof sessionStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SYNC_STATE_KEY) || "null");
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.ok === "boolean" &&
      typeof parsed.at === "number"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function wasRecentReminderSyncFailure(now = Date.now()): boolean {
  const state = readSyncState();
  return Boolean(state && !state.ok && now - state.at <= FAILURE_WINDOW_MS);
}

export function buildReminderUpsert(
  userId: string,
  schedule: ScheduleItem,
): ScheduledReminderUpsert | null {
  if (!schedule.alarm || schedule.status === "done") return null;
  const due = effectiveAlarmAt(schedule);
  if (!due || due.getTime() <= Date.now()) return null;
  const dueIso = due.toISOString();
  return {
    user_id: userId,
    schedule_id: schedule.id,
    due_at_utc: dueIso,
    timezone: resolveUserTimezone(),
    status: "pending",
    idempotency_key: reminderIdempotencyKey(schedule.id, dueIso),
  };
}

/** Cancel pending/processing reminders for a schedule. */
export async function cancelScheduleReminders(
  userId: string,
  scheduleId: string,
): Promise<boolean> {
  if (import.meta.env.VITE_E2E === "true") return true;
  const { error } = await supabase
    .from("scheduled_reminders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("schedule_id", scheduleId)
    .in("status", ["pending", "processing"]);
  if (error) {
    console.error("[reminders] cancel failed", error.message);
    rememberReminderSyncResult(false);
    return false;
  }
  return true;
}

export type SyncScheduleReminderResult = {
  ok: boolean;
  /** True when a future pending row was written for cron delivery. */
  queued: boolean;
  reason?: "past_due" | "no_alarm" | "sync_failed";
};

/**
 * Replace the server reminder when an alarm changes.
 * `queued: false` with `ok: true` means there is nothing future to deliver
 * (e.g. alarm time already passed) — do not pretend a closed-app alarm is armed.
 */
export async function syncScheduleReminder(
  userId: string,
  schedule: ScheduleItem,
): Promise<boolean> {
  const result = await syncScheduleReminderDetailed(userId, schedule);
  return result.ok;
}

export async function syncScheduleReminderDetailed(
  userId: string,
  schedule: ScheduleItem,
): Promise<SyncScheduleReminderResult> {
  if (import.meta.env.VITE_E2E === "true") {
    return { ok: true, queued: true };
  }
  try {
    const cancelled = await cancelScheduleReminders(userId, schedule.id);
    if (!cancelled) {
      return { ok: false, queued: false, reason: "sync_failed" };
    }

    if (!schedule.alarm || schedule.status === "done") {
      rememberReminderSyncResult(true);
      return { ok: true, queued: false, reason: "no_alarm" };
    }

    const row = buildReminderUpsert(userId, schedule);
    if (!row) {
      rememberReminderSyncResult(true);
      return { ok: true, queued: false, reason: "past_due" };
    }

    const { error } = await supabase.from("scheduled_reminders").upsert(row, {
      onConflict: "idempotency_key",
    });
    if (error) {
      console.error("[reminders] schedule failed", error.message);
      rememberReminderSyncResult(false);
      return { ok: false, queued: false, reason: "sync_failed" };
    }
    rememberReminderSyncResult(true);
    return { ok: true, queued: true };
  } catch (error) {
    console.error("[reminders] unexpected sync failure", error);
    rememberReminderSyncResult(false);
    return { ok: false, queued: false, reason: "sync_failed" };
  }
}

async function cancelStaleServerReminders(
  userId: string,
  activeScheduleIds: Set<string>,
): Promise<boolean> {
  if (import.meta.env.VITE_E2E === "true") return true;

  const { data, error } = await supabase
    .from("scheduled_reminders")
    .select("schedule_id")
    .eq("user_id", userId)
    .in("status", ["pending", "processing"]);

  if (error) {
    console.error("[reminders] stale lookup failed", error.message);
    rememberReminderSyncResult(false);
    return false;
  }

  const staleIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.schedule_id as string | null)
        .filter((id): id is string => Boolean(id) && !activeScheduleIds.has(id!)),
    ),
  ];

  let ok = true;
  for (const scheduleId of staleIds) {
    if (!(await cancelScheduleReminders(userId, scheduleId))) ok = false;
  }
  return ok;
}

/**
 * Reconcile the backend queue from the canonical schedule list.
 *
 * This is deliberately surface-agnostic: Home natural-language confirmation,
 * Decision Deck, calendar edits, reminder toggles and deletions all converge on
 * the same schedule store, so every path receives the same closed-app reminder
 * guarantees without duplicating backend code in each UI.
 */
export async function syncAllScheduleReminders(
  userId: string,
  schedules: ScheduleItem[],
): Promise<boolean> {
  if (import.meta.env.VITE_E2E === "true") return true;

  const active = schedules.filter(
    (schedule) =>
      schedule.alarm &&
      schedule.status !== "done" &&
      Boolean(buildReminderUpsert(userId, schedule)),
  );
  const activeIds = new Set(active.map((schedule) => schedule.id));

  let allOk = await cancelStaleServerReminders(userId, activeIds);

  for (const schedule of active) {
    let result = await syncScheduleReminderDetailed(userId, schedule);

    // A just-created signed-in schedule is written locally first and then to
    // Supabase. If the reminder FK arrives a beat early, retry once after the
    // canonical schedule row has had time to land.
    if (!result.ok) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      result = await syncScheduleReminderDetailed(userId, schedule);
    }

    if (!result.ok) allOk = false;
  }

  rememberReminderSyncResult(allOk);
  return allOk;
}
