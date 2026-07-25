/**
 * Semantic motion — calm confidence, 180–240ms.
 */

export const MOTION_CALM = {
  duration: 0.2,
  ease: [0.32, 0.72, 0, 1] as const,
};

export const MOTION_CALM_SLOW = {
  duration: 0.24,
  ease: [0.32, 0.72, 0, 1] as const,
};

export const MOTION_THINKING = MOTION_CALM_SLOW;

/** Calmer reveal for Today / Archive / Rediscovery — not Capture. */
export const MOTION_CRAFT = MOTION_CALM_SLOW;

export const MOTION_SCHEDULE = MOTION_CALM;

export const MOTION_ARCHIVE = MOTION_CALM;

export const MOTION_DELETE = MOTION_CALM;

export const MOTION_UNDO = MOTION_CALM;

export const MOTION_SUCCESS = MOTION_CALM_SLOW;

export const MOTION_SHEET = {
  duration: 0.24,
  ease: [0.32, 0.72, 0, 1] as const,
};

export const MOTION_STEP = MOTION_CALM;

/** Exit targets per swipe direction in Focus Mode */
export function exitSpring(dir: "left" | "right" | "up") {
  if (dir === "up") return MOTION_DELETE;
  if (dir === "right") return MOTION_SCHEDULE;
  return MOTION_ARCHIVE;
}
