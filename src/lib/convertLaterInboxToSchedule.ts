import { thoughtFirstLine } from "@/lib/brainMirror";
import { clearInboxTombstones } from "@/lib/decisionRecovery";
import {
  attachExactTemporalPatch,
  clearTemporalMetadataPatch,
} from "@/lib/recordTemporal";
import { contentRevisionOf } from "@/lib/recordRevision";
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
  getScheduleByRecordId: (recordId: string) => ScheduleItem | undefined;
  getInboxById?: (recordId: string) => InboxItem | undefined;
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
 * A store reader can lag one render behind a user edit. Revisions are
 * monotonic, so a strictly older observed row cannot supersede the action
 * snapshot. Equal revisions are different: clarification UI may pass a derived
 * interpretation with changed text but the canonical raw record must stay the
 * source of truth, so the observed canonical row wins on equality.
 */
function canonicalForCommit(
  item: InboxItem,
  observed: InboxItem | undefined,
  expectedRevision: number,
): InboxItem {
  if (!observed) return item;
  return contentRevisionOf(observed) < expectedRevision ? item : observed;
}

function hasNewerRevision(
  expectedRevision: number,
  observed: InboxItem | undefined,
): boolean {
  return Boolean(observed && contentRevisionOf(observed) > expectedRevision);
}

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
    const expected = options?.expectedRevision ?? contentRevisionOf(item);
    const observed = ops.getInboxById?.(item.id);
    if (hasNewerRevision(expected, observed)) {
      return { status: "stale_revision" };
    }
    const live = canonicalForCommit(item, observed, expected);

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
        if (ok === false) return { status: "create_failed" };
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

    const observedAfter = ops.getInboxById?.(item.id);
    if (hasNewerRevision(expected, observedAfter)) {
      if (!existing) await ops.removeSchedule(scheduleId);
      return { status: "stale_revision" };
    }
    const liveAfter = canonicalForCommit(item, observedAfter, expected);

    try {
      const patched = await ops.updateInbox(
        item.id,
        attachExactTemporalPatch({
          text: liveAfter.text,
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

export const commitInboxToSchedule = convertLaterInboxToSchedule;

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
      if (removed === false) return { status: "remove_failed" };
    } catch {
      return { status: "remove_failed" };
    }

    clearInboxTombstones(inboxItem.id);
    try {
      const cleared = await ops.updateInbox(
        inboxItem.id,
        clearTemporalMetadataPatch(),
      );
      if (cleared === false) throw new Error("clear temporal failed");
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

export function resetLaterInboxConvertLocksForTests() {
  inFlightIds.clear();
}
