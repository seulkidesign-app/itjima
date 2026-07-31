import {
  MAX_ROTATE,
  cardScale,
  cardShadowBlur,
  dragProgress,
} from "@/lib/motion";

export { dragProgress, cardScale, cardShadowBlur };

/** Rubber-band resistance beyond drag limit (iOS-style). */
export const SWIPE_RUBBER = 0.18;

/** Distance commit: 30% of card/screen width. */
export const SWIPE_DISTANCE_RATIO = 0.3;

/**
 * Fling commit — 0.5 px/ms ≡ 500 px/s (gesture libs often report ~0.5).
 */
export const SWIPE_VELOCITY_COMMIT = 500;

export function rubberBand(
  value: number,
  limit: number,
  factor = SWIPE_RUBBER,
): number {
  const abs = Math.abs(value);
  if (abs <= limit) return value;
  const excess = abs - limit;
  const sign = value >= 0 ? 1 : -1;
  return sign * (limit + excess * factor);
}

export function swipeRotation(dx: number, cardWidth: number): number {
  if (cardWidth <= 0) return 0;
  return Math.max(
    -MAX_ROTATE,
    Math.min(MAX_ROTATE, dx * (MAX_ROTATE / (cardWidth * 0.5))),
  );
}

/** Card opacity fades with drag progress. */
export function swipeOpacity(absDx: number, maxDrag: number): number {
  return Math.max(0.72, 1 - absDx / (maxDrag * 3.5));
}

/** Commit when past 30% width or fling velocity > 0.5 (px/ms → 500 px/s). */
export function shouldSwipeCommit(
  absDx: number,
  threshold: number,
  velocityX: number,
  velocityThreshold = SWIPE_VELOCITY_COMMIT,
): boolean {
  return absDx >= threshold || Math.abs(velocityX) >= velocityThreshold;
}

export function swipeThreshold(cardWidth: number): number {
  return cardWidth * SWIPE_DISTANCE_RATIO;
}
