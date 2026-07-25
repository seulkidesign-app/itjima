import { track } from "@/lib/analytics";
import type { DecisionOutcome } from "@/lib/store";

type InputMethod = "gesture" | "button" | "keyboard";
type SwipeAction = DecisionOutcome;

function durationBucket(ms: number): string {
  if (ms < 30_000) return "under_30s";
  if (ms < 120_000) return "under_2m";
  if (ms < 300_000) return "under_5m";
  return "over_5m";
}

export function trackSwipeSessionStarted(queueCount: number) {
  track("swipe_session_started", { queue_count: queueCount });
}

export function trackSwipeCardShown(opts: {
  predictedIntent?: string;
  hasBrainMirror: boolean;
}) {
  track("swipe_card_shown", {
    ...(opts.predictedIntent ? { predicted_intent: opts.predictedIntent } : {}),
    has_brain_mirror: opts.hasBrainMirror,
  });
}

export function trackSwipeStarted(direction: "right" | "left" | "down") {
  track("swipe_started", { direction_candidate: direction });
}

export function trackSwipeCancelled(direction: "right" | "left" | "down") {
  track("swipe_cancelled", { direction_candidate: direction });
}

export function trackSwipeCommitted(
  action: SwipeAction,
  inputMethod: InputMethod,
) {
  track("swipe_committed", { action, input_method: inputMethod });
}

export function trackSwipeUndoUsed(action: SwipeAction) {
  track("swipe_undo_used", { action });
}

export function trackSwipeSessionCompleted(opts: {
  scheduledCount: number;
  archivedCount: number;
  keptCount: number;
  durationMs: number;
}) {
  track("swipe_session_completed", {
    scheduled_count: opts.scheduledCount,
    archived_count: opts.archivedCount,
    kept_count: opts.keptCount,
    duration_bucket: durationBucket(opts.durationMs),
  });
}

export function trackSwipeTutorialShown() {
  track("swipe_tutorial_shown");
}

export function trackSwipeTutorialDismissed() {
  track("swipe_tutorial_dismissed");
}

/** @deprecated bridge to swipe_* events */
export function trackDecisionLegacy(
  outcome: DecisionOutcome,
  props: Record<string, string | number | boolean>,
) {
  track(`decision_${outcome}`, props);
  trackSwipeCommitted(outcome, "button");
}
