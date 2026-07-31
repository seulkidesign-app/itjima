/**
 * Semantic motion — iOS tokens (--dur-fast/base/slow + --ease-out).
 */

import {
  MOTION_DURATION,
  MOTION_DURATION_SLOW,
  MOTION_EASE,
  MOTION_EASE_IN_OUT,
  SPRING_DEFAULT,
} from "@/lib/motion";

export const MOTION_CALM = {
  duration: MOTION_DURATION,
  ease: MOTION_EASE,
};

export const MOTION_CALM_SLOW = {
  duration: MOTION_DURATION_SLOW,
  ease: MOTION_EASE,
};

export const MOTION_THINKING = MOTION_CALM_SLOW;

/** Calmer reveal for Today / Archive / Rediscovery — not Capture. */
export const MOTION_CRAFT = MOTION_CALM_SLOW;

export const MOTION_SCHEDULE = MOTION_CALM;

export const MOTION_ARCHIVE = MOTION_CALM;

export const MOTION_DELETE = MOTION_CALM;

export const MOTION_UNDO = MOTION_CALM;

export const MOTION_SETTLE = SPRING_DEFAULT;

export const MOTION_SUCCESS = {
  duration: MOTION_DURATION_SLOW,
  ease: MOTION_EASE,
};

export const MOTION_SHEET = {
  duration: MOTION_DURATION,
  ease: MOTION_EASE,
};

export const MOTION_STEP = MOTION_CALM;

export const MOTION_PAGE = {
  duration: MOTION_DURATION_SLOW,
  ease: MOTION_EASE,
};

export const MOTION_EXIT = {
  duration: MOTION_DURATION,
  ease: MOTION_EASE_IN_OUT,
};

/** Exit targets per swipe direction in Focus Mode */
export function exitSpring(dir: "left" | "right" | "up") {
  if (dir === "up") return MOTION_DELETE;
  if (dir === "right") return MOTION_SCHEDULE;
  return MOTION_ARCHIVE;
}
