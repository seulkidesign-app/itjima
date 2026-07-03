/**
 * Semantic motion personalities — each action communicates intention.
 * @see Interaction Redesign Sprint v2.0
 */

export const MOTION_THINKING = {
  type: "spring" as const,
  stiffness: 180,
  damping: 22,
  mass: 1.15,
};

export const MOTION_SCHEDULE = {
  type: "spring" as const,
  stiffness: 260,
  damping: 26,
  mass: 0.95,
};

export const MOTION_ARCHIVE = {
  type: "spring" as const,
  stiffness: 340,
  damping: 30,
  mass: 0.88,
};

export const MOTION_DELETE = {
  type: "spring" as const,
  stiffness: 480,
  damping: 36,
  mass: 0.42,
};

export const MOTION_UNDO = {
  type: "spring" as const,
  stiffness: 240,
  damping: 24,
  mass: 1.05,
};

export const MOTION_SUCCESS = {
  type: "spring" as const,
  stiffness: 200,
  damping: 22,
  mass: 1.1,
};

export const MOTION_SHEET = {
  type: "spring" as const,
  stiffness: 380,
  damping: 34,
  mass: 0.85,
};

export const MOTION_STEP = {
  type: "spring" as const,
  stiffness: 400,
  damping: 32,
  mass: 0.7,
};

/** Exit targets per swipe direction in Focus Mode */
export function exitSpring(dir: "left" | "right" | "up") {
  if (dir === "up") return MOTION_DELETE;
  if (dir === "right") return MOTION_SCHEDULE;
  return MOTION_ARCHIVE;
}
