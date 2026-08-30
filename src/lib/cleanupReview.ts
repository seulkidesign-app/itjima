import { isStructuredTimedRecord } from "@/lib/recordTemporal";
import type { InboxItem } from "@/lib/store";

export type CleanupDuplicateGroup = {
  kind: "exact_duplicate";
  key: string;
  items: InboxItem[];
};

function normalizeDuplicateText(text: string): string {
  return text.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function isCleanupEligible(item: InboxItem): boolean {
  if (item.status && item.status !== "active") return false;
  if (isStructuredTimedRecord(item)) return false;
  if (item.clarification_state === "pending") return false;
  if (item.temporal_state === "ambiguous") return false;
  if (item.images?.length) return false;
  return normalizeDuplicateText(item.text).length > 0;
}

/**
 * P2 Cleanup contract.
 *
 * Cleanup is review-only and conservative. It may point out exact text
 * duplicates, but it never treats age, short text, tone, or conversational
 * language as evidence that a record is disposable.
 *
 * This selector does not mutate, rank for deletion, or preselect anything.
 */
export function findCleanupDuplicateGroups(
  items: InboxItem[],
): CleanupDuplicateGroup[] {
  const grouped = new Map<string, InboxItem[]>();

  for (const item of items) {
    if (!isCleanupEligible(item)) continue;
    const key = normalizeDuplicateText(item.text);
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }

  return [...grouped.entries()]
    .filter(([, bucket]) => bucket.length >= 2)
    .map(([key, bucket]) => ({
      kind: "exact_duplicate" as const,
      key,
      items: [...bucket].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      ),
    }))
    .sort((a, b) => {
      const aNewest = +new Date(a.items[0]?.created_at ?? 0);
      const bNewest = +new Date(b.items[0]?.created_at ?? 0);
      return bNewest - aNewest;
    });
}
