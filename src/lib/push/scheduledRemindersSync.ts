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

/**
 * Replace the server reminder when an alarm changes. A false result means the
 * local in-app reminder remains valid, but background delivery was not proven.
 */
export async function syncScheduleReminder(
  userId: string,
  schedule: ScheduleItem,
): Promise<boolean> {
  if (import.meta.env.VITE_E2E === "true") return true;
  try {
    const cancelled = await cancelScheduleReminders(userId, schedule.id);
    if (!cancelled) return false;

    const row = buildReminderUpsert(userId, schedule);
    if (!row) {
      rememberReminderSyncResult(true);
      return true;
    }

    const { error } = await supabase.from("scheduled_reminders").upsert(row, {
      onConflict: "idempotency_key",
    });
    if (error) {
      console.error("[reminders] schedule failed", error.message);
      rememberReminderSyncResult(false);
      return false;
    }
    rememberReminderSyncResult(true);
    return true;
  } catch (error) {
    console.error("[reminders] unexpected sync failure", error);
    rememberReminderSyncResult(false);
    return false;
  }
}

export async function syncAllScheduleReminders(
  userId: string,
  schedules: ScheduleItem[],
): Promise<void> {
  if (import.meta.env.VITE_E2E === "true") return;
  for (const s of schedules) {
    if (s.alarm && s.status !== "done") {
      const ok = await syncScheduleReminder(userId, s);
      if (!ok) console.error("[reminders] bulk sync deferred", s.id);
    }
  }
}
