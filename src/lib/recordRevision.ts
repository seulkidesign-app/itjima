import type { InboxItem } from "@/lib/store";

/** Monotonic local counter bumped on user text/time edits. */
export function contentRevisionOf(
  item: Pick<InboxItem, "content_revision"> | undefined | null,
): number {
  return item?.content_revision ?? 0;
}

export function nextContentRevision(
  current?: number | null,
): number {
  return (current ?? 0) + 1;
}

/**
 * True when an async parser/AI request captured an older revision than the
 * live canonical record — the response must not overwrite user edits.
 */
export function isStaleContentRevision(
  requestRevision: number,
  current: Pick<InboxItem, "content_revision"> | undefined | null,
): boolean {
  if (!current) return true;
  return contentRevisionOf(current) !== requestRevision;
}

/** Merge a bump into an inbox patch for user-driven text/time mutations. */
export function withBumpedContentRevision(
  current: Pick<InboxItem, "content_revision"> | undefined | null,
  patch: Partial<InboxItem> = {},
): Partial<InboxItem> {
  return {
    ...patch,
    content_revision: nextContentRevision(current?.content_revision),
  };
}
