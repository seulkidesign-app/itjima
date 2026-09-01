import { getBrowsableRecords } from "@/lib/canonicalBrowse";
import { dedupeScheduleProjections } from "@/lib/scheduleProjection";
import type { InboxItem, ScheduleItem } from "@/lib/store";

export type BrowseRecordEntry =
  | {
      kind: "record";
      id: string;
      canonicalId: string;
      text: string;
      created_at: string;
      status: InboxItem["status"];
      start_time?: string | null;
      all_day?: boolean | null;
      temporal_state?: InboxItem["temporal_state"];
      clarification_state?: InboxItem["clarification_state"];
      raw_text?: string | null;
      record: InboxItem;
    }
  | {
      kind: "schedule";
      id: string;
      canonicalId: string;
      text: string;
      created_at: string;
      status: ScheduleItem["status"];
      start_time: string;
      all_day?: boolean;
      raw_text?: string | null;
      schedule: ScheduleItem;
    };

/**
 * User-facing "All records" read model.
 *
 * Canonical Inbox remains authoritative whenever it exists. Historical/manual
 * Schedule rows that never received a canonical Inbox row are included once so
 * the UI does not claim a smaller "All records" total than the Schedule view.
 * If a canonical row exists but is deleted/archived, its projection is not
 * resurrected as a standalone browse entry.
 */
export function getAllBrowseEntries(
  inboxItems: readonly InboxItem[],
  scheduleItems: readonly ScheduleItem[],
): BrowseRecordEntry[] {
  const allCanonicalIds = new Set(inboxItems.map((item) => item.id));
  const records: BrowseRecordEntry[] = getBrowsableRecords(inboxItems).map(
    (record) => ({
      kind: "record",
      id: record.id,
      canonicalId: record.id,
      text: record.text,
      created_at: record.created_at,
      status: record.status,
      start_time: record.start_time,
      all_day: record.all_day,
      temporal_state: record.temporal_state,
      clarification_state: record.clarification_state,
      raw_text: record.raw_text,
      record,
    }),
  );

  const standaloneSchedules: BrowseRecordEntry[] = dedupeScheduleProjections(
    scheduleItems,
  )
    .filter((schedule) => {
      const canonicalId = schedule.source_id || schedule.id;
      return !allCanonicalIds.has(canonicalId);
    })
    .map((schedule) => ({
      kind: "schedule",
      id: schedule.id,
      canonicalId: schedule.source_id || schedule.id,
      text: schedule.text,
      created_at: schedule.created_at,
      status: schedule.status,
      start_time: schedule.start_time,
      all_day:
        schedule.all_day ??
        schedule.start_all_day ??
        schedule.end_all_day ??
        false,
      raw_text: schedule.raw_text,
      schedule,
    }));

  return [...records, ...standaloneSchedules].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function searchAllBrowseEntries(
  inboxItems: readonly InboxItem[],
  scheduleItems: readonly ScheduleItem[],
  query: string,
): BrowseRecordEntry[] {
  const entries = getAllBrowseEntries(inboxItems, scheduleItems);
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((entry) =>
    `${entry.text ?? ""}\n${entry.raw_text ?? ""}`.toLowerCase().includes(q),
  );
}
