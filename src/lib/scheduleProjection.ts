import type { ScheduleItem } from "@/lib/store";

/**
 * Locate the derived schedule projection for a canonical record.
 * Supports both M1 same-id projections and legacy random-id + source_id rows.
 */
export function findScheduleProjection(
  schedules: readonly ScheduleItem[],
  recordId: string,
): ScheduleItem | undefined {
  const sameId = schedules.find((s) => s.id === recordId);
  if (sameId) return sameId;
  return schedules.find((s) => s.source_id === recordId);
}

/**
 * Drop duplicate projections for the same canonical id (legacy + new).
 * Prefers the same-id row when both exist.
 */
export function dedupeScheduleProjections(
  schedules: readonly ScheduleItem[],
): ScheduleItem[] {
  const byCanonical = new Map<string, ScheduleItem>();
  for (const s of schedules) {
    const canonical = s.source_id || s.id;
    const existing = byCanonical.get(canonical);
    if (!existing) {
      byCanonical.set(canonical, s);
      continue;
    }
    if (s.id === canonical && existing.id !== canonical) {
      byCanonical.set(canonical, s);
    }
  }
  const winners = new Set(
    [...byCanonical.values()].map((s) => s.id),
  );
  return schedules.filter((s) => winners.has(s.id));
}
