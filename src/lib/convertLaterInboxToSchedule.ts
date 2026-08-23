import { thoughtFirstLine } from "@/lib/brainMirror";
import { clearInboxTombstones } from "@/lib/decisionRecovery";
import { scheduleFromInbox } from "@/lib/thoughtProvenance";
import type { InboxItem, RepeatRule, ScheduleItem } from "@/lib/store";

export type LaterInboxScheduleFields = {
  text: string;
  start_time: string;
  end_time: string;
  alarm?: boolean;
  all_day?: boolean;
  start_all_day?: boolean;
  end_all_day?: boolean;
  repeat?: RepeatRule | null;
  alarm_at?: string | null;
};

export type ConvertLaterInboxOps = {
  addSchedule: (
    payload: ReturnType<typeof scheduleFromInbox> & {
      alarm_at?: string | null;
    },
  ) => Promise<{ item: Pick<ScheduleItem, "id">; cloudSynced: boolean }>;
  removeSchedule: (id: string) => Promise<boolean | void>;
  removeInbox: (id: string) => Promise<boolean>;
  restoreInbox: (item: InboxItem) => Promise<void>;
};

export type ConvertLaterInboxResult =
  | { status: "ok"; scheduleId: string }
  | { status: "busy" }
  | { status: "create_failed" }
  | { status: "remove_failed_rolled_back" };

export type UndoScheduleToInboxResult =
  | { status: "ok" }
  | { status: "busy" }
  | { status: "remove_failed" }
  | { status: "restore_failed_schedule_recreated"; scheduleId: string }
  | { status: "restore_failed" };

const inFlightIds = new Set<string>();

/** Title shown in the schedule sheet when opening a no-time later inbox row. */
export function laterInboxScheduleDraftTitle(item: InboxItem): string {
  return thoughtFirstLine(item.text);
}

async function rollbackCreatedSchedule(
  ops: ConvertLaterInboxOps,
  scheduleId: string,
  inboxItem: InboxItem,
) {
  await ops.removeSchedule(scheduleId);
  clearInboxTombstones(inboxItem.id);
  await ops.restoreInbox(inboxItem);
}

/**
 * Shared inbox → schedule commit for capture auto-commit, AM/PM resolve,
 * and later-inbox conversion.
 *
 * Order is create-schedule → remove-inbox. Never deletes the inbox first.
 * On create failure the inbox is untouched. On remove failure the new schedule
 * is rolled back and the inbox is restored so the item is not duplicated.
 */
export async function convertLaterInboxToSchedule(
  item: InboxItem,
  fields: LaterInboxScheduleFields,
  ops: ConvertLaterInboxOps,
): Promise<ConvertLaterInboxResult> {
  if (inFlightIds.has(item.id)) {
    return { status: "busy" };
  }
  inFlightIds.add(item.id);

  try {
    const { alarm_at, ...scheduleFields } = fields;
    const payload = {
      ...scheduleFromInbox(item, scheduleFields),
      ...(alarm_at !== undefined ? { alarm_at } : {}),
    };

    let created: Pick<ScheduleItem, "id">;
    let cloudSynced: boolean;
    try {
      ({ item: created, cloudSynced } = await ops.addSchedule(payload));
    } catch {
      return { status: "create_failed" };
    }

    if (!cloudSynced) {
      // Confirmed create failed (and store opt-in may already have rolled back).
      // removeSchedule is idempotent cleanup if an optimistic remnant remains.
      await ops.removeSchedule(created.id);
      return { status: "create_failed" };
    }

    try {
      const removed = await ops.removeInbox(item.id);
      if (!removed) {
        await rollbackCreatedSchedule(ops, created.id, item);
        return { status: "remove_failed_rolled_back" };
      }
    } catch {
      await rollbackCreatedSchedule(ops, created.id, item);
      return { status: "remove_failed_rolled_back" };
    }

    return { status: "ok", scheduleId: created.id };
  } finally {
    inFlightIds.delete(item.id);
  }
}

/** Alias used by capture auto-commit / clarify paths. */
export const commitInboxToSchedule = convertLaterInboxToSchedule;

/**
 * Undo an auto-committed schedule back to a durable left item (raw inbox).
 * Never leaves both schedule and inbox present.
 */
export async function undoScheduleToInbox(
  scheduleId: string,
  inboxItem: InboxItem,
  fields: LaterInboxScheduleFields,
  ops: ConvertLaterInboxOps,
): Promise<UndoScheduleToInboxResult> {
  const lockId = `undo:${scheduleId}`;
  if (inFlightIds.has(lockId) || inFlightIds.has(inboxItem.id)) {
    return { status: "busy" };
  }
  inFlightIds.add(lockId);
  inFlightIds.add(inboxItem.id);

  try {
    try {
      const removed = await ops.removeSchedule(scheduleId);
      if (removed === false) {
        return { status: "remove_failed" };
      }
    } catch {
      return { status: "remove_failed" };
    }

    clearInboxTombstones(inboxItem.id);
    try {
      await ops.restoreInbox(inboxItem);
    } catch {
      // Restore failed after schedule delete — recreate schedule so text is not lost.
      try {
        const { alarm_at, ...scheduleFields } = fields;
        const payload = {
          ...scheduleFromInbox(inboxItem, scheduleFields),
          ...(alarm_at !== undefined ? { alarm_at } : {}),
        };
        const { item: created, cloudSynced } = await ops.addSchedule(payload);
        if (!cloudSynced) {
          await ops.removeSchedule(created.id);
          return { status: "restore_failed" };
        }
        return {
          status: "restore_failed_schedule_recreated",
          scheduleId: created.id,
        };
      } catch {
        return { status: "restore_failed" };
      }
    }

    return { status: "ok" };
  } finally {
    inFlightIds.delete(lockId);
    inFlightIds.delete(inboxItem.id);
  }
}

/** Test-only: clear in-flight locks between cases. */
export function resetLaterInboxConvertLocksForTests() {
  inFlightIds.clear();
}
