import type { DecisionOutcome, InboxItem } from "@/lib/store";

export type { DecisionOutcome };

export const DECISION_TODAY_RATIO = 0.25;
export const DECISION_LATER_MIN_RATIO = 0.25;
export const DECISION_ARCHIVE_RATIO = 0.65;

/** Active inbox rows still waiting for a deck decision. */
export function pendingDecisionItems(items: InboxItem[]) {
  return items.filter((it) => !it.decision);
}

/** Map horizontal drag to a committed outcome, or null to snap back. */
export function resolveDragOutcome(
  x: number,
  cardWidth: number,
): DecisionOutcome | null {
  if (cardWidth <= 0) return null;
  const w = cardWidth;
  if (x <= -w * DECISION_TODAY_RATIO) return "today";
  if (x >= w * DECISION_ARCHIVE_RATIO) return "archive";
  if (x >= w * DECISION_LATER_MIN_RATIO) return "later";
  return null;
}

/** Preview label target while dragging (ignores vertical-dominant gestures). */
export function previewDragOutcome(
  x: number,
  y: number,
  cardWidth: number,
): DecisionOutcome | null {
  if (Math.abs(x) <= Math.abs(y)) return null;
  return resolveDragOutcome(x, cardWidth);
}

export function dragProgressForOutcome(
  x: number,
  outcome: DecisionOutcome,
  cardWidth: number,
): number {
  if (cardWidth <= 0) return 0;
  const w = cardWidth;
  if (outcome === "today") {
    return Math.min(1, Math.max(0, -x / (w * DECISION_TODAY_RATIO)));
  }
  if (outcome === "later") {
    const start = w * DECISION_LATER_MIN_RATIO;
    const end = w * DECISION_ARCHIVE_RATIO;
    return Math.min(1, Math.max(0, (x - start) / Math.max(1, end - start)));
  }
  return Math.min(1, Math.max(0, x / (w * DECISION_ARCHIVE_RATIO)));
}
