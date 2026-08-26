import {
  attachExactTemporalPatch,
  clearTemporalMetadataPatch,
} from "@/lib/recordTemporal";
import { withBumpedContentRevision } from "@/lib/recordRevision";
import { findScheduleProjection } from "@/lib/scheduleProjection";
import { scheduleFromInbox } from "@/lib/thoughtProvenance";
import type { InboxItem, ScheduleItem } from "@/lib/store";

export type CanonicalMutationOps = {
  getInboxById: (id: string) => InboxItem | undefined;
  updateInbox: (
    id: string,
    patch: Partial<InboxItem>,
  ) => Promise<boolean | void>;
  softDeleteInbox: (id: string) => Promise<boolean | void>;
  getSchedules: () => readonly ScheduleItem[];
  updateSchedule: (
    id: string,
    patch: Partial<ScheduleItem>,
  ) => Promise<boolean | void>;
  removeSchedule: (id: string) => Promise<boolean | void>;
  /** Restore a projection with its original id (partial may include `id`). */
  addSchedule: (
    payload: Partial<ScheduleItem> & { text: string; start_time: string; end_time: string },
  ) => Promise<{ item: ScheduleItem; cloudSynced: boolean } | void>;
};

/** Exact pre-delete state for undo — no DB migration. */
export type DeleteUndoSnapshot = {
  record: InboxItem;
  projection: ScheduleItem | null;
};

export type TemporalSyncFields = {
  start_time: string;
  end_time: string;
  all_day?: boolean;
  text?: string;
};

function projectionFor(
  ops: CanonicalMutationOps,
  recordId: string,
): ScheduleItem | undefined {
  return findScheduleProjection(ops.getSchedules(), recordId);
}

/** Canonical text + revision bump + matching projection text. */
export async function syncRecordText(
  recordId: string,
  text: string,
  ops: CanonicalMutationOps,
): Promise<boolean> {
  const current = ops.getInboxById(recordId);
  if (!current) return false;
  const patch = withBumpedContentRevision(current, { text });
  const ok = await ops.updateInbox(recordId, patch);
  if (ok === false) return false;
  const proj = projectionFor(ops, recordId);
  if (proj) {
    await ops.updateSchedule(proj.id, { text });
  }
  return true;
}

/**
 * Set or clear temporal metadata on the canonical record, then sync projection.
 * `fields === null` clears time and removes the projection (record stays).
 */
export async function syncRecordTemporal(
  recordId: string,
  fields: TemporalSyncFields | null,
  ops: CanonicalMutationOps,
): Promise<boolean> {
  const current = ops.getInboxById(recordId);
  if (!current) return false;

  if (fields === null) {
    const patch = withBumpedContentRevision(
      current,
      clearTemporalMetadataPatch(),
    );
    const ok = await ops.updateInbox(recordId, patch);
    if (ok === false) return false;
    const proj = projectionFor(ops, recordId);
    if (proj) await ops.removeSchedule(proj.id);
    return true;
  }

  const patch = withBumpedContentRevision(
    current,
    attachExactTemporalPatch({
      start_time: fields.start_time,
      end_time: fields.end_time,
      all_day: fields.all_day,
      text: fields.text,
    }),
  );
  const ok = await ops.updateInbox(recordId, patch);
  if (ok === false) return false;

  const text = fields.text ?? current.text;
  const proj = projectionFor(ops, recordId);
  if (proj) {
    await ops.updateSchedule(proj.id, {
      text,
      start_time: fields.start_time,
      end_time: fields.end_time,
      all_day: fields.all_day ?? false,
      status: proj.status ?? "active",
      source_id: recordId,
    });
  }
  return true;
}

export async function completeRecord(
  recordId: string,
  ops: CanonicalMutationOps,
): Promise<boolean> {
  const current = ops.getInboxById(recordId);
  if (!current) return false;
  const ok = await ops.updateInbox(recordId, { status: "done" });
  if (ok === false) return false;
  const proj = projectionFor(ops, recordId);
  if (proj) await ops.updateSchedule(proj.id, { status: "done" });
  return true;
}

export async function undoCompleteRecord(
  recordId: string,
  ops: CanonicalMutationOps,
): Promise<boolean> {
  const current = ops.getInboxById(recordId);
  if (!current) return false;
  const ok = await ops.updateInbox(recordId, { status: "active" });
  if (ok === false) return false;
  const proj = projectionFor(ops, recordId);
  if (proj) await ops.updateSchedule(proj.id, { status: "active" });
  return true;
}

/**
 * Soft-delete canonical + remove projection. Returns snapshot for exact undo.
 */
export async function deleteRecord(
  recordId: string,
  ops: CanonicalMutationOps,
): Promise<DeleteUndoSnapshot | null> {
  const current = ops.getInboxById(recordId);
  if (!current) return null;

  const proj = projectionFor(ops, recordId);
  const snapshot: DeleteUndoSnapshot = {
    record: { ...current },
    projection: proj ? { ...proj } : null,
  };

  // Drop every matching projection row (same-id and legacy source_id).
  const matches = ops
    .getSchedules()
    .filter((s) => s.id === recordId || s.source_id === recordId);
  for (const row of matches) {
    await ops.removeSchedule(row.id);
  }
  const ok = await ops.softDeleteInbox(recordId);
  if (ok === false) return null;
  return snapshot;
}

/**
 * Restore exact pre-delete canonical state and recreate projection if any.
 */
export async function undoDeleteRecord(
  snapshot: DeleteUndoSnapshot,
  ops: CanonicalMutationOps,
): Promise<boolean> {
  const { record } = snapshot;
  let { projection } = snapshot;
  const {
    id,
    text,
    images,
    created_at,
    status,
    brain_mirror,
    decision,
    decided_at,
    decision_source,
    capture_state,
    raw_text,
    start_time,
    end_time,
    all_day,
    temporal_state,
    structured_at,
    clarification_state,
    content_revision,
  } = record;

  const restorePatch: Partial<InboxItem> = {
    text,
    images,
    created_at,
    status: status === "deleted" ? "active" : (status ?? "active"),
    brain_mirror,
    decision,
    decided_at,
    decision_source,
    capture_state,
    raw_text,
    start_time: start_time ?? null,
    end_time: end_time ?? null,
    all_day: all_day ?? null,
    temporal_state: temporal_state ?? null,
    structured_at: structured_at ?? null,
    clarification_state: clarification_state ?? null,
    content_revision,
  };

  const ok = await ops.updateInbox(id, restorePatch);
  if (ok === false) return false;

  // If delete raced without a projection snapshot but the record was timed,
  // rebuild the derived schedule so undo never yields an undated timed record.
  if (
    !projection &&
    start_time &&
    end_time &&
    temporal_state === "exact_datetime"
  ) {
    const rebuilt = scheduleFromInbox(record, {
      text,
      start_time,
      end_time,
      all_day: all_day ?? false,
    });
    projection = {
      ...rebuilt,
      created_at: structured_at ?? created_at,
      status: status === "done" ? "done" : "active",
    };
  }

  if (projection) {
    const existing = projectionFor(ops, id);
    if (existing) {
      await ops.updateSchedule(existing.id, {
        text: projection.text,
        start_time: projection.start_time,
        end_time: projection.end_time,
        alarm: projection.alarm,
        all_day: projection.all_day,
        start_all_day: projection.start_all_day,
        end_all_day: projection.end_all_day,
        repeat: projection.repeat,
        source_id: projection.source_id ?? id,
        raw_text: projection.raw_text,
        brain_mirror: projection.brain_mirror,
        status: projection.status ?? "active",
        alarm_at: projection.alarm_at,
      });
    } else {
      await ops.addSchedule({
        id: projection.id,
        text: projection.text,
        start_time: projection.start_time,
        end_time: projection.end_time,
        alarm: projection.alarm ?? false,
        created_at: projection.created_at,
        all_day: projection.all_day,
        start_all_day: projection.start_all_day,
        end_all_day: projection.end_all_day,
        repeat: projection.repeat,
        source_id: projection.source_id ?? id,
        raw_text: projection.raw_text,
        brain_mirror: projection.brain_mirror,
        status: projection.status ?? "active",
        alarm_at: projection.alarm_at,
      });
    }
  }

  return true;
}

/** Resolve canonical id from a schedule row (legacy or same-id). */
export function canonicalIdFromSchedule(s: ScheduleItem): string {
  return s.source_id || s.id;
}
