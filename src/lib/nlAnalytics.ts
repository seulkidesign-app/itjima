import { track } from "@/lib/analytics";
import type { NlIntent, ScheduleConfidence } from "@/lib/nlSchedule";

/** NL analytics — never include thought text or sensitive content. */
export function trackIntentPredicted(
  intent: NlIntent,
  confidence: ScheduleConfidence,
) {
  track("intent_predicted", { intent, confidence });
}

export function trackIntentConfirmed(
  intent: NlIntent,
  corrected = false,
) {
  track("intent_confirmed", { intent, corrected });
}

export function trackIntentCorrected(from: NlIntent, to: NlIntent) {
  track("intent_corrected", { from_intent: from, to_intent: to });
}

export function trackClarifyOpened() {
  track("clarify_opened");
}

export function trackManualFallbackUsed(from: NlIntent) {
  track("manual_fallback_used", { from_intent: from });
}

export function trackParseFailed(intent: NlIntent) {
  track("parse_failed", { intent });
}
