import type { DecisionOutcome, InboxItem } from "@/lib/store";

type StoredRow = Record<string, unknown> & { id?: string };

type DecisionStorageSnapshot = {
  scheduleIds: Set<string>;
  archiveIds: Set<string>;
  inboxDecision?: unknown;
  inboxPresent: boolean;
};

type UndoLike = {
  item: InboxItem;
  outcome: DecisionOutcome;
  scheduleId?: string;
  archiveId?: string;
};

type TombstoneTable = "inbox" | "schedules" | "archive";

function storageAvailable() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readRowsForBucket(bucket: "inbox" | "schedules" | "archive"): StoredRow[] {
  if (!storageAvailable()) return [];
  const rows: StoredRow[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key !== `itjima.${bucket}` && !key.endsWith(`.${bucket}`)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(parsed)) {
        rows.push(...parsed.filter((row): row is StoredRow => Boolean(row && typeof row === "object")));
      }
    } catch {
      // Ignore malformed legacy buckets; the canonical store handles migration.
    }
  }
  return rows;
}

function activeInboxRow(itemId: string) {
  return readRowsForBucket("inbox").find(
    (row) => row.id === itemId && row.status !== "deleted" && row.status !== "archived",
  );
}

function destinationIds(bucket: "schedules" | "archive", itemId: string) {
  return new Set(
    readRowsForBucket(bucket)
      .filter((row) => row.source_id === itemId)
      .map((row) => String(row.id || ""))
      .filter(Boolean),
  );
}

export function captureDecisionStorage(itemId: string): DecisionStorageSnapshot {
  const inbox = activeInboxRow(itemId);
  return {
    scheduleIds: destinationIds("schedules", itemId),
    archiveIds: destinationIds("archive", itemId),
    inboxDecision: inbox?.decision,
    inboxPresent: Boolean(inbox),
  };
}

function firstNewId(after: Set<string>, before: Set<string>) {
  for (const id of after) {
    if (!before.has(id)) return id;
  }
  return null;
}

/**
 * A cloud write may still be pending even though the local-first transaction
 * already completed. Recover the result only when storage proves the intended
 * local state was committed.
 */
export function recoverLocallyCommittedDecision(
  outcome: DecisionOutcome,
  itemId: string,
  before: DecisionStorageSnapshot,
): { scheduleId?: string; archiveId?: string } | null {
  const inbox = activeInboxRow(itemId);

  if (outcome === "later") {
    return inbox?.decision === "later" ? {} : null;
  }

  if (outcome === "today") {
    // M1: canonical inbox stays; recovery looks for a new projection
    // (legacy source_id or same-id as the record).
    const after = destinationIds("schedules", itemId);
    for (const row of readRowsForBucket("schedules")) {
      if (row.id === itemId) after.add(String(row.id));
    }
    const id = firstNewId(after, before.scheduleIds);
    return id ? { scheduleId: id } : null;
  }

  // Archive still removes the inbox row.
  if (inbox) return null;

  const id = firstNewId(destinationIds("archive", itemId), before.archiveIds);
  return id ? { archiveId: id } : null;
}

/**
 * A local-first delete leaves a tombstone when its cloud DELETE fails. If the
 * user later restores that entity, the matching tombstone must be cancelled or
 * the next sync will delete the freshly restored row again.
 */
function clearTombstones(itemId: string, table: TombstoneTable) {
  if (!storageAvailable()) return;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.endsWith(".tombstones")) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(parsed)) continue;
      const next = parsed.filter(
        (row) =>
          !(
            row &&
            typeof row === "object" &&
            row.id === itemId &&
            row.table === table
          ),
      );
      if (next.length !== parsed.length) {
        localStorage.setItem(key, JSON.stringify(next));
      }
    } catch {
      // A malformed tombstone bucket should not block a visible undo.
    }
  }
}

/** Undoing a failed Inbox cloud delete must cancel its pending tombstone. */
export function clearInboxTombstones(itemId: string) {
  clearTombstones(itemId, "inbox");
}

/** Restoring a Schedule projection must cancel its failed-delete tombstone. */
export function clearScheduleTombstones(scheduleId: string) {
  clearTombstones(scheduleId, "schedules");
}

export function undoLocallyCommitted(snapshot: UndoLike) {
  const inbox = activeInboxRow(snapshot.item.id);
  if (!inbox) return false;

  if (snapshot.outcome === "later") {
    return inbox.decision !== "later";
  }

  if (snapshot.outcome === "today" && snapshot.scheduleId) {
    return !readRowsForBucket("schedules").some((row) => row.id === snapshot.scheduleId);
  }

  if (snapshot.outcome === "archive" && snapshot.archiveId) {
    return !readRowsForBucket("archive").some((row) => row.id === snapshot.archiveId);
  }

  return true;
}
