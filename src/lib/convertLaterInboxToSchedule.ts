import { thoughtFirstLine } from "@/lib/brainMirror";
import { clearInboxTombstones } from "@/lib/decisionRecovery";
import {
  attachExactTemporalPatch,
  clearTemporalMetadataPatch,
} from "@/lib/recordTemporal";
import {
  contentRevisionOf,
  isStaleContentRevision,
} from "@/lib/recordRevision";
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
  updateSchedule: (
    id: string,
    patch: Partial<ScheduleItem>,
  ) => Promise<boolean | void>;
  removeSchedule: (id: string) => Promise<boolean | void>;
  /** Find existing projection by canonical id (same id or source_id). */
  getScheduleByRecordId: (recordId: string) => ScheduleItem | undefined;
  /** Current canonical row (for stale-revision checks). */
  getInboxById?: (recordId: string) => InboxItem | undefined;
  /** Patch canonical inbox record — never delete on timed attach. */
  updateInbox: (id: string, patch: Partial<InboxItem>) => Promise<boolean | void>;
};

export type ConvertLaterInboxResult =
  | { status: "ok"; scheduleId: string }
  | { status: "busy" }
  | { status: "create_failed" }
  | { status: "attach_failed_rolled_back" }
  | { status: "stale_revision" };

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

function projectionPayload(
  item: InboxItem,
  fields: LaterInboxScheduleFields,
) {
  const { alarm_at, ...scheduleFields } = fields;
  return {
    ...scheduleFromInbox(item, scheduleFields),
    ...(alarm_at !== undefined ? { alarm_at } : {}),
  };
}

/**
 * Attach structured time to a canonical inbox record and upsert its
 * ScheduleItem projection. Never deletes the inbox record.
 *
 * Identity: prefer ScheduleItem.id === InboxItem.id; always set source_id.
 * Legacy rows (random id + source_id) are updated in place — no duplicate.
 *
 * Pass `expectedRevision` when the commit was started from an async parse so
 * a user edit mid-flight rejects the stale apply.
 */
export async function convertLaterInboxToSchedule(
  item: InboxItem,
  fields: LaterInboxScheduleFields,
  ops: ConvertLaterInboxOps,
  options?: { expectedRevision?: number },
): Promise<ConvertLaterInboxResult> {
  if (inFlightIds.has(item.id)) {
    return { status: "busy" };
  }
  inFlightIds.add(item.id);

  try {
    const expected =
      options?.expectedRevision ?? contentRevisionOf(item);
    const live = ops.getInboxById?.(item.id) ?? item;
    if (isStaleContentRevision(expected, live)) {
      return { status: "stale_revision" };
    }

    const payload = projectionPayload(live, fields);
    const existing = ops.getScheduleByRecordId(item.id);
    let scheduleId = existing?.id ?? item.id;

    if (existing) {
      try {
        const ok = await ops.updateSchedule(existing.id, {
          text: payload.text,
          start_time: payload.start_time,
          end_time: payload.end_time,
          alarm: payload.alarm,
          all_day: payload.all_day,
          start_all_day: payload.start_all_day,
          end_all_day: payload.end_all_day,
          repeat: payload.repeat,
          alarm_at: payload.alarm_at,
          source_id: item.id,
          raw_text: payload.raw_text,
          status: "active",
        });
        if (ok === false) {
          return { status: "create_failed" };
        }
      } catch {
        return { status: "create_failed" };
      }
      scheduleId = existing.id;
    } else {
      let created: Pick<ScheduleItem, "id">;
      let cloudSynced: boolean;
      try {
        ({ item: created, cloudSynced } = await ops.addSchedule(payload));
      } catch {
        return { status: "create_failed" };
      }

      if (!cloudSynced) {
        await ops.removeSchedule(created.id);
        return { status: "create_failed" };
      }
      scheduleId = created.id;
    }

    // Re-check after async schedule write — user may have edited meanwhile.
    const liveAfter = ops.getInboxById?.(item.id) ?? live;
    if (isStaleContentRevision(expected, liveAfter)) {
      // Only roll back a projection we just created; leave legacy updates alone
      // when stale — safer than wiping an older schedule the user may still want.
      if (!existing) {
        await ops.removeSchedule(scheduleId);
      }
      return { status: "stale_revision" };
    }

    try {
      const patched = await ops.updateInbox(
        item.id,
        attachExactTemporalPatch({
          start_time: fields.start_time,
          end_time: fields.end_time,
          all_day: fields.all_day,
        }),
      );
      if (patched === false) {
        if (!existing) await ops.removeSchedule(scheduleId);
        return { status: "attach_failed_rolled_back" };
      }
    } catch {
      if (!existing) await ops.removeSchedule(scheduleId);
      return { status: "attach_failed_rolled_back" };
    }

    clearInboxTombstones(item.id);
    return { status: "ok", scheduleId };
  } finally {
    inFlightIds.delete(item.id);
  }
}

/** Alias used by capture auto-commit / clarify paths. */
export const commitInboxToSchedule = convertLaterInboxToSchedule;

/**
 * Undo timed attach: remove schedule projection and clear temporal metadata
 * on the canonical record. The record itself stays.
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
      const cleared = await ops.updateInbox(
        inboxItem.id,
        clearTemporalMetadataPatch(),
      );
      if (cleared === false) {
        throw new Error("clear temporal failed");
      }
    } catch {
      try {
        const payload = projectionPayload(inboxItem, fields);
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
