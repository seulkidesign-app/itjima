import type { DecisionOutcome, InboxItem } from "@/lib/store";
import { isStructuredTimedRecord } from "@/lib/recordTemporal";
import {
  SWIPE_DISTANCE_RATIO,
  SWIPE_KEEP_RATIO,
  SWIPE_PREVIEW_START_RATIO,
  SWIPE_VELOCITY_X,
  SWIPE_VELOCITY_Y,
} from "@/lib/swipeInteraction";

export type { DecisionOutcome };

export type DragAxis = "horizontal" | "vertical" | null;

/** Active inbox rows still waiting for a deck decision. */
export function pendingDecisionItems(items: InboxItem[]) {
  return items.filter(
    (it) => !it.decision && !isStructuredTimedRecord(it),
  );
}

/** Lock drag to one axis once movement clearly dominates. */
export function resolveDragAxis(
  x: number,
  y: number,
  locked: DragAxis,
): DragAxis {
  if (locked) return locked;
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (absX < 8 && absY < 8) return null;
  if (absX > absY * 1.15) return "horizontal";
  if (absY > absX * 1.15) return "vertical";
  return null;
}

/** Map drag to outcome: right=schedule, left=archive, down=keep. */
export function resolveDragOutcome(
  x: number,
  y: number,
  cardWidth: number,
  cardHeight: number,
  axis: DragAxis = null,
): DecisionOutcome | null {
  if (cardWidth <= 0 || cardHeight <= 0) return null;
  const resolved = axis ?? resolveDragAxis(x, y, null);
  if (resolved === "vertical") {
    return y >= cardHeight * SWIPE_KEEP_RATIO ? "later" : null;
  }
  if (resolved === "horizontal" || Math.abs(x) > Math.abs(y)) {
    if (x >= cardWidth * SWIPE_DISTANCE_RATIO) return "today";
    if (x <= -cardWidth * SWIPE_DISTANCE_RATIO) return "archive";
  }
  return null;
}

/** Preview label while dragging (starts before commit threshold). */
export function previewDragOutcome(
  x: number,
  y: number,
  cardWidth: number,
  cardHeight: number,
  axis: DragAxis = null,
): DecisionOutcome | null {
  if (cardWidth <= 0 || cardHeight <= 0) return null;
  const resolved = axis ?? resolveDragAxis(x, y, null);
  if (resolved === "vertical") {
    return y >= cardHeight * SWIPE_PREVIEW_START_RATIO ? "later" : null;
  }
  if (resolved === "horizontal" || Math.abs(x) > Math.abs(y)) {
    if (x >= cardWidth * SWIPE_PREVIEW_START_RATIO) return "today";
    if (x <= -cardWidth * SWIPE_PREVIEW_START_RATIO) return "archive";
  }
  return null;
}

function dragProgressBetween(value: number, start: number, end: number) {
  if (value <= start) return 0;
  if (value >= end) return 1;
  return (value - start) / (end - start);
}

export function dragProgressForOutcome(
  x: number,
  y: number,
  outcome: DecisionOutcome,
  cardWidth: number,
  cardHeight: number,
): number {
  if (cardWidth <= 0 || cardHeight <= 0) return 0;
  if (outcome === "today") {
    const start = cardWidth * SWIPE_PREVIEW_START_RATIO;
    const end = cardWidth * SWIPE_DISTANCE_RATIO;
    return dragProgressBetween(x, start, end);
  }
  if (outcome === "archive") {
    const start = cardWidth * SWIPE_PREVIEW_START_RATIO;
    const end = cardWidth * SWIPE_DISTANCE_RATIO;
    return dragProgressBetween(-x, start, end);
  }
  const start = cardHeight * SWIPE_PREVIEW_START_RATIO;
  const end = cardHeight * SWIPE_KEEP_RATIO;
  return dragProgressBetween(y, start, end);
}

/** Whether release should commit given position and velocity. */
export function shouldCommitDrag(
  x: number,
  y: number,
  vx: number,
  vy: number,
  cardWidth: number,
  cardHeight: number,
  axis: DragAxis,
): DecisionOutcome | null {
  const horizontal = axis === "horizontal" || (axis === null && Math.abs(x) >= Math.abs(y));
  const vertical = axis === "vertical" || (axis === null && Math.abs(y) > Math.abs(x));

  if (horizontal) {
    if ((x > 0 && vx > SWIPE_VELOCITY_X) || x >= cardWidth * SWIPE_DISTANCE_RATIO) {
      return "today";
    }
    if ((x < 0 && vx < -SWIPE_VELOCITY_X) || x <= -cardWidth * SWIPE_DISTANCE_RATIO) {
      return "archive";
    }
    return null;
  }

  if (vertical) {
    if ((y > 0 && vy > SWIPE_VELOCITY_Y) || y >= cardHeight * SWIPE_KEEP_RATIO) {
      return "later";
    }
  }

  return null;
}

/** @deprecated use SWIPE_DISTANCE_RATIO — kept for transitional imports */
export const DECISION_TODAY_RATIO = SWIPE_DISTANCE_RATIO;
export const DECISION_LATER_MIN_RATIO = SWIPE_DISTANCE_RATIO;
export const DECISION_ARCHIVE_RATIO = SWIPE_DISTANCE_RATIO;
