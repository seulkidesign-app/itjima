/** Shared Decision Deck interaction tokens — tune here, not in components. */

/** Horizontal commit zone — 28–34% of card width. */
export const SWIPE_DISTANCE_RATIO = 0.31;

/** Downward keep zone — 22–28% of card height. */
export const SWIPE_KEEP_RATIO = 0.25;

/** Fling velocity (px/s) for horizontal commit. */
export const SWIPE_VELOCITY_X = 720;

/** Fling velocity (px/s) for downward keep. */
export const SWIPE_VELOCITY_Y = 680;

/** Max horizontal rubber-band drag (px). */
export const SWIPE_MAX_DRAG_X = 340;

/** Max vertical rubber-band drag (px). */
export const SWIPE_MAX_DRAG_Y = 160;

/** Max card rotation during horizontal drag (degrees). */
export const SWIPE_MAX_ROTATE = 6;

/** Preview label appears after this progress fraction. */
export const SWIPE_PREVIEW_PROGRESS = 0.28;

/** Drag distance before outcome preview (fraction of card width/height). */
export const SWIPE_PREVIEW_START_RATIO = 0.12;

/** Threshold haptic fires at this progress fraction. */
export const SWIPE_THRESHOLD_PROGRESS = 0.92;

/** Movement before axis lock (px). */
export const SWIPE_AXIS_LOCK_PX = 10;

/** Screen-edge zone where horizontal swipe does not start (px). */
export const SWIPE_EDGE_EXCLUSION_PX = 20;

/** Pointer movement before drag begins (avoids link/tap conflicts). */
export const SWIPE_DRAG_START_PX = 8;

/** Card stack peek — second card scale / third card scale. */
export const STACK_SCALE = [0.97, 0.94] as const;
export const STACK_OFFSET_Y = [10, 20] as const;
export const STACK_OPACITY = [0.42, 0.22] as const;
