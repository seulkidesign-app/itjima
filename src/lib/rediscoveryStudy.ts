import { track } from "@/lib/analytics";

const FIRST_VISIT_KEY = "itjima.rediscovery.study.first_visit_at";
const LAST_VISIT_KEY = "itjima.rediscovery.study.last_visit_at";
const REDISCOVERY_SESSION_KEY = "itjima.rediscovery.session";
const NEW_VISIT_GAP_MS = 30 * 60 * 1000;

export type RediscoveryReturnGapBucket =
  | "first"
  | "30m_23h"
  | "1_2d"
  | "3_6d"
  | "7d_plus";

export type RediscoveryStudyAgeBucket = "day_0_2" | "day_3_6" | "day_7_plus";

export type RediscoveryStudyVisit = {
  newVisit: boolean;
  isReturnVisit: boolean;
  returnGapBucket?: RediscoveryReturnGapBucket;
  studyAgeBucket?: RediscoveryStudyAgeBucket;
};

function readFiniteTimestamp(key: string): number | null {
  if (typeof window === "undefined") return null;
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function returnGapBucket(gapMs: number): RediscoveryReturnGapBucket {
  const days = gapMs / 86400000;
  if (days < 1) return "30m_23h";
  if (days < 3) return "1_2d";
  if (days < 7) return "3_6d";
  return "7d_plus";
}

function studyAgeBucket(ageMs: number): RediscoveryStudyAgeBucket {
  const days = ageMs / 86400000;
  if (days < 3) return "day_0_2";
  if (days < 7) return "day_3_6";
  return "day_7_plus";
}

/**
 * Starts one longitudinal Rediscovery study visit.
 *
 * A visit is device-local and deduped for 30 minutes so refresh/back navigation
 * cannot inflate return counts. No record id, text, title, user id, or other
 * user-entered content is emitted.
 *
 * We also clear the per-session Rediscovery suppression key on a genuinely new
 * visit. This keeps the product meaning of "this visit" stable even when a PWA
 * runtime preserves sessionStorage across close/reopen.
 */
export function beginRediscoveryStudyVisit(
  now = Date.now(),
): RediscoveryStudyVisit {
  if (typeof window === "undefined") {
    return { newVisit: false, isReturnVisit: false };
  }

  const lastVisitAt = readFiniteTimestamp(LAST_VISIT_KEY);
  const firstVisitAt = readFiniteTimestamp(FIRST_VISIT_KEY);
  const gapMs = lastVisitAt === null ? null : Math.max(0, now - lastVisitAt);

  if (gapMs !== null && gapMs < NEW_VISIT_GAP_MS) {
    return { newVisit: false, isReturnVisit: false };
  }

  const studyStartedAt = firstVisitAt ?? now;
  if (firstVisitAt === null) {
    localStorage.setItem(FIRST_VISIT_KEY, String(studyStartedAt));
  }
  localStorage.setItem(LAST_VISIT_KEY, String(now));
  sessionStorage.removeItem(REDISCOVERY_SESSION_KEY);

  const isReturnVisit = lastVisitAt !== null;
  const gapBucket: RediscoveryReturnGapBucket = isReturnVisit
    ? returnGapBucket(gapMs ?? 0)
    : "first";
  const ageBucket = studyAgeBucket(Math.max(0, now - studyStartedAt));

  track("rediscovery_session_start", {
    return_gap_bucket: gapBucket,
    study_age_bucket: ageBucket,
  });

  return {
    newVisit: true,
    isReturnVisit,
    returnGapBucket: gapBucket,
    studyAgeBucket: ageBucket,
  };
}
