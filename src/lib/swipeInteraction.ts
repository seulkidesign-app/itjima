/** Shared Decision Deck interaction tokens — tune here, not in components. */

/** Horizontal commit zone — intentionally light enough for one-thumb use. */
export const SWIPE_DISTANCE_RATIO = 0.22;

/** Downward keep zone — a short deliberate pull. */
export const SWIPE_KEEP_RATIO = 0.2;

/**
 * Pointer velocity in DecisionDeck is measured in px/ms.
 * 0.5 px/ms equals 500 px/s, so a natural quick flick can commit.
 */
export const SWIPE_VELOCITY_X = 0.5;

/** Fling velocity (px/ms) for downward keep. */
export const SWIPE_VELOCITY_Y = 0.5;

/** Max horizontal rubber-band drag (px). */
export const SWIPE_MAX_DRAG_X = 340;

/** Max vertical rubber-band drag (px). */
export const SWIPE_MAX_DRAG_Y = 160;

/** Max card rotation during horizontal drag (degrees) — Tinder ±12°. */
export const SWIPE_MAX_ROTATE = 12;

/** Preview label appears after this progress fraction. */
export const SWIPE_PREVIEW_PROGRESS = 0.24;

/** Drag distance before outcome preview (fraction of card width/height). */
export const SWIPE_PREVIEW_START_RATIO = 0.09;

/** Threshold haptic fires shortly before release threshold. */
export const SWIPE_THRESHOLD_PROGRESS = 0.86;

/** Movement before axis lock (px). */
export const SWIPE_AXIS_LOCK_PX = 10;

/** Screen-edge exclusion kept small so one-thumb swipes have more usable area. */
export const SWIPE_EDGE_EXCLUSION_PX = 12;

/** Pointer movement before drag begins (avoids accidental taps). */
export const SWIPE_DRAG_START_PX = 6;

/** Card stack peek — second card scale / third card scale. */
export const STACK_SCALE = [0.97, 0.94] as const;
export const STACK_OFFSET_Y = [10, 20] as const;
export const STACK_OPACITY = [0.42, 0.22] as const;
