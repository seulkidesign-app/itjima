type TableName = "inbox" | "schedules" | "archive";
type ThoughtStatus = "active" | "done" | "archived" | "deleted";
type ScheduleStatus = "active" | "done";

const INBOX_STATUS_RANK: Record<ThoughtStatus, number> = {
  active: 0,
  done: 1,
  archived: 2,
  deleted: 3,
};

/** Prefer local inbox status when it is a stronger tombstone than cloud. */
export function shouldPreferLocalInboxStatus(
  local?: ThoughtStatus,
  cloud?: ThoughtStatus,
): boolean {
  if (!local || local === "active") return false;
  const localRank = INBOX_STATUS_RANK[local] ?? 0;
  const cloudRank = INBOX_STATUS_RANK[cloud ?? "active"] ?? 0;
  return localRank > cloudRank;
}

export function mergeCloudRow<T extends { id: string }>(
  cloud: T,
  local: T | undefined,
  table: TableName,
): T {
  if (!local) return cloud;

  const merged: Record<string, unknown> = { ...cloud };
  const localRow = local as Record<string, unknown>;
  const cloudRow = cloud as Record<string, unknown>;

  if (localRow.brain_mirror && !cloudRow.brain_mirror) {
    merged.brain_mirror = localRow.brain_mirror;
  }

  if (table === "inbox") {
    const localStatus = localRow.status as ThoughtStatus | undefined;
    const cloudStatus = cloudRow.status as ThoughtStatus | undefined;
    if (shouldPreferLocalInboxStatus(localStatus, cloudStatus)) {
      merged.status = localStatus;
    }

    // Decision Deck metadata is local-first in v1. Preserve it when the
    // production cloud schema does not yet expose these optional columns.
    for (const key of [
      "decision",
      "decided_at",
      "decision_source",
      "capture_state",
      "raw_text",
      "start_time",
      "end_time",
      "all_day",
      "temporal_state",
      "structured_at",
      "clarification_state",
      "content_revision",
    ] as const) {
      if (localRow[key] !== undefined && cloudRow[key] === undefined) {
        merged[key] = localRow[key];
      }
    }

    // Prefer a higher local content_revision so stale cloud rows cannot
    // overwrite a fresher user edit that has not synced yet.
    const localRev = Number(localRow.content_revision ?? 0);
    const cloudRev = Number(cloudRow.content_revision ?? 0);
    if (localRev > cloudRev) {
      merged.text = localRow.text;
      merged.content_revision = localRev;
      for (const key of [
        "start_time",
        "end_time",
        "all_day",
        "temporal_state",
        "structured_at",
        "clarification_state",
        "raw_text",
      ] as const) {
        if (localRow[key] !== undefined) merged[key] = localRow[key];
      }
    }
  }

  if (table === "schedules") {
    const localStatus = localRow.status as ScheduleStatus | undefined;
    const cloudStatus = cloudRow.status as ScheduleStatus | undefined;
    if (localStatus === "done" && cloudStatus !== "done") {
      merged.status = localStatus;
    }
  }

  return merged as T;
}
