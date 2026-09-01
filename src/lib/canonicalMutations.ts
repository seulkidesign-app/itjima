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

async function restoreProjectionRow(
  row: ScheduleItem,
  ops: CanonicalMutationOps,
): Promise<void> {
  if (ops.getSchedules().some((current) => current.id === row.id)) return;
  await ops.addSchedule({
    id: row.id,
    text: row.text,
    start_time: row.start_time,
    end_time: row.end_time,
    alarm: row.alarm ?? false,
    created_at: row.created_at,
    all_day: row.all_day,
    start_all_day: row.start_all_day,
    end_all_day: row.end_all_day,
    repeat: row.repeat,
    source_id: row.source_id,
    raw_text: row.raw_text,
    brain_mirror: row.brain_mirror,
    status: row.status ?? "active",
    alarm_at: row.alarm_at,
  });
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
  // Keep exact row snapshots so a failed canonical delete cannot eat the
  // schedule projection while leaving the source record active.
  const matches = ops
    .getSchedules()
    .filter((s) => s.id === recordId || s.source_id === recordId)
    .map((row) => ({ ...row }));
  for (const row of matches) {
    await ops.removeSchedule(row.id);
  }
  const ok = await ops.softDeleteInbox(recordId);
  if (ok === false) {
    for (const row of matches) {
      await restoreProjectionRow(row, ops);
    }
    return null;
  }
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

  // If delete raced without a projection snapshot but the record was already
  // structured, rebuild the derived schedule for exact, date-only and fuzzy
  // temporal states alike. Partial precision is still a real schedule state.
  if (
    !projection &&
    start_time &&
    end_time &&
    (temporal_state === "exact_datetime" ||
      temporal_state === "date_only" ||
      temporal_state === "fuzzy_time")
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
      await restoreProjectionRow(
        { ...projection, source_id: projection.source_id ?? id },
        ops,
      );
    }
  }

  return true;
}

/** Resolve canonical id from a schedule row (legacy or same-id). */
export function canonicalIdFromSchedule(s: ScheduleItem): string {
  return s.source_id || s.id;
}