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

  let merged: Record<string, unknown> = { ...cloud };
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
