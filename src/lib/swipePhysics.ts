import {
  MAX_ROTATE,
  cardScale,
  cardShadowBlur,
  dragProgress,
} from "@/lib/motion";

export { dragProgress, cardScale, cardShadowBlur };

/** Rubber-band resistance beyond drag limit (iOS-style). */
export const SWIPE_RUBBER = 0.18;

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

/** Card opacity fades slightly at extreme drag. */
export function swipeOpacity(absDx: number, maxDrag: number): number {
  return Math.max(0.72, 1 - absDx / (maxDrag * 3.5));
}

/** Commit when past threshold or fling velocity exceeds px/s. */
export function shouldSwipeCommit(
  absDx: number,
  threshold: number,
  velocityX: number,
  velocityThreshold = 420,
): boolean {
  return absDx >= threshold || Math.abs(velocityX) >= velocityThreshold;
}
