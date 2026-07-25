import { supabase } from "@/integrations/supabase/client";
import type { ScheduleItem } from "@/lib/store";
import {
  reminderIdempotencyKey,
} from "@/lib/push/reminderPayload";
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
): Promise<void> {
  if (import.meta.env.VITE_E2E === "true") return;
  await supabase
    .from("scheduled_reminders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("schedule_id", scheduleId)
    .in("status", ["pending", "processing"]);
}

/** Replace server reminder when schedule alarm changes. */
export async function syncScheduleReminder(
  userId: string,
  schedule: ScheduleItem,
): Promise<void> {
  if (import.meta.env.VITE_E2E === "true") return;
  await cancelScheduleReminders(userId, schedule.id);
  const row = buildReminderUpsert(userId, schedule);
  if (!row) return;
  await supabase.from("scheduled_reminders").upsert(row, {
    onConflict: "idempotency_key",
  });
}

export async function syncAllScheduleReminders(
  userId: string,
  schedules: ScheduleItem[],
): Promise<void> {
  if (import.meta.env.VITE_E2E === "true") return;
  for (const s of schedules) {
    if (s.alarm && s.status !== "done") {
      await syncScheduleReminder(userId, s);
    }
  }
}
