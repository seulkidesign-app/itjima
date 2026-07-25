import { track } from "@/lib/analytics";
import type { NlIntent, ScheduleConfidence } from "@/lib/nlSchedule";

type CaptureSource = "text" | "voice";
type FallbackType = "calendar" | "add_date" | "clarify_chip";
type PrimaryAction =
  | "add_schedule"
  | "add_task"
  | "archive"
  | "keep"
  | "clarify_chip"
  | "pick_date";

/** Privacy-safe NL beta analytics — never include thought text or extracted titles. */
export function trackNlThoughtSubmitted(opts: {
  textLength: number;
  language: "ko" | "en";
  source: CaptureSource;
}) {
  track("nl_thought_submitted", {
    text_length: opts.textLength,
    language: opts.language,
    source: opts.source,
  });
}

export function trackNlIntentPredicted(
  intent: NlIntent,
  confidenceTier: ScheduleConfidence,
) {
  track("nl_intent_predicted", { intent, confidence_tier: confidenceTier });
}

export function trackNlBrainMirrorShown(intent: NlIntent) {
  track("nl_brain_mirror_shown", { intent });
}

export function trackNlPrimaryActionClicked(
  intent: NlIntent,
  action: PrimaryAction,
) {
  track("nl_primary_action_clicked", { intent, action });
}

export function trackNlIntentCorrected(from: NlIntent, to: NlIntent) {
  track("nl_intent_corrected", { from_intent: from, to_intent: to });
}

export function trackNlManualFallbackUsed(
  fromIntent: NlIntent,
  fallbackType: FallbackType,
) {
  track("nl_manual_fallback_used", {
    from_intent: fromIntent,
    fallback_type: fallbackType,
  });
}

export function trackNlBrainMirrorDismissed(intent: NlIntent) {
  track("nl_brain_mirror_dismissed", { intent });
}

export function trackNlParseFailed(errorType: "missing_date" | "commit_error") {
  track("nl_parse_failed", { error_type: errorType });
}

export function trackNlScheduleCreated() {
  track("nl_schedule_created");
}

export function trackNlTaskCreated() {
  track("nl_task_created");
}

export function trackNlArchiveCreated() {
  track("nl_archive_created");
}

/** @deprecated use trackNlIntentPredicted */
export function trackIntentPredicted(
  intent: NlIntent,
  confidence: ScheduleConfidence,
) {
  trackNlIntentPredicted(intent, confidence);
}

/** @deprecated use trackNlPrimaryActionClicked */
export function trackIntentConfirmed(_intent: NlIntent, _corrected = false) {
  // kept for transitional imports — prefer trackNlPrimaryActionClicked
}

/** @deprecated use trackNlIntentCorrected */
export function trackIntentCorrected(from: NlIntent, to: NlIntent) {
  trackNlIntentCorrected(from, to);
}

/** @deprecated */
export function trackClarifyOpened() {}

/** @deprecated use trackNlManualFallbackUsed */
export function trackManualFallbackUsed(from: NlIntent) {
  trackNlManualFallbackUsed(from, "calendar");
}

/** @deprecated use trackNlParseFailed */
export function trackParseFailed(_intent: NlIntent) {
  trackNlParseFailed("missing_date");
}
