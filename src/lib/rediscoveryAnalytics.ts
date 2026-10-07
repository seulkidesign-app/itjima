import { track } from "@/lib/analytics";
import { readArchiveVisits } from "@/lib/archiveMeta";
import type { RediscoveryPick, RediscoveryReason } from "@/lib/rediscoveryPick";

export type RediscoveryUtEvent = "impression" | "open" | "later" | "hide";
export type RediscoveryAction = "view_schedule" | "open_record";
export type RediscoveryAgeBucket =
  | "lt_3d"
  | "3_6d"
  | "7_20d"
  | "21_59d"
  | "60d_plus";
export type RediscoveryVisitBucket = "0" | "1" | "2_plus";

export type RediscoveryAnalyticsContext = {
  reason: RediscoveryReason;
  age_bucket: RediscoveryAgeBucket;
  visit_bucket: RediscoveryVisitBucket;
  has_related_schedule: boolean;
  repeat_visit: boolean;
  source: "record" | "archive";
};

function ageDays(createdAt: string, nowMs: number) {
  return Math.max(0, Math.floor((nowMs - new Date(createdAt).getTime()) / 86400000));
}

function ageBucket(days: number): RediscoveryAgeBucket {
  if (days < 3) return "lt_3d";
  if (days <= 6) return "3_6d";
  if (days <= 20) return "7_20d";
  if (days <= 59) return "21_59d";
  return "60d_plus";
}

function visitBucket(visits: number): RediscoveryVisitBucket {
  if (visits <= 0) return "0";
  if (visits === 1) return "1";
  return "2_plus";
}

/**
 * Privacy boundary for Rediscovery analytics.
 * Deliberately excludes memory id, text/raw_text, title, tags and user-entered content.
 */
export function buildRediscoveryAnalyticsContext(
  pick: RediscoveryPick,
  nowMs = Date.now(),
): RediscoveryAnalyticsContext {
  const days = ageDays(pick.memory.created_at, nowMs);
  const visits = readArchiveVisits()[pick.key] ?? 0;

  return {
    reason: pick.reason,
    age_bucket: ageBucket(days),
    visit_bucket: visitBucket(visits),
    has_related_schedule: Boolean(pick.relatedSchedule),
    repeat_visit: visits > 0,
    source: pick.memory.rediscovery_source,
  };
}

export function trackRediscoveryUt(
  event: RediscoveryUtEvent,
  pick: RediscoveryPick,
) {
  track(`rediscovery_${event}`, buildRediscoveryAnalyticsContext(pick));
}

export function trackRediscoveryAction(
  action: RediscoveryAction,
  pick: RediscoveryPick,
) {
  track("rediscovery_action", {
    ...buildRediscoveryAnalyticsContext(pick),
    action,
  });
}
