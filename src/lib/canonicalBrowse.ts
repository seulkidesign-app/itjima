import type { InboxItem, ThoughtStatus } from "@/lib/store";

/** Browse/Search view policy: active + done, never deleted/archived. */
export function isBrowsableRecord(
  item: Pick<InboxItem, "status">,
): boolean {
  const status: ThoughtStatus = item.status ?? "active";
  return status === "active" || status === "done";
}

/**
 * Canonical All Records list. Source of truth is Inbox only —
 * never merge schedule projections as separate rows.
 */
export function getBrowsableRecords(
  items: readonly InboxItem[],
): InboxItem[] {
  return items
    .filter(isBrowsableRecord)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

function haystack(item: InboxItem): string {
  return `${item.text ?? ""}\n${item.raw_text ?? ""}`.toLowerCase();
}

/**
 * Search canonical browsable records (active + done).
 * Empty / whitespace query returns the full browsable set.
 */
export function searchCanonicalRecords(
  items: readonly InboxItem[],
  query: string,
): InboxItem[] {
  const browsable = getBrowsableRecords(items);
  const q = query.trim().toLowerCase();
  if (!q) return browsable;
  return browsable.filter((item) => haystack(item).includes(q));
}
