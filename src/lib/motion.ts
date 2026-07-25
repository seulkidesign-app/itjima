/** Calm UI transitions — 180–240ms, no playful spring. */
export const MOTION_EASE = [0.32, 0.72, 0, 1] as const;
export const MOTION_DURATION = 0.2;
export const MOTION_DURATION_SLOW = 0.24;

export const TRANSITION_CALM = {
  duration: MOTION_DURATION,
  ease: MOTION_EASE,
} as const;

export const TRANSITION_CALM_SLOW = {
  duration: MOTION_DURATION_SLOW,
  ease: MOTION_EASE,
} as const;

/** @deprecated Prefer TRANSITION_CALM for chrome; kept for drag snap-back only. */
export const SPRING_DEFAULT = {
  type: "spring" as const,
  stiffness: 320,
  damping: 28,
  mass: 0.8,
};

export const SPRING_SNAP_BACK = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.75,
};

export const SPRING_SHEET = {
  type: "spring" as const,
  stiffness: 380,
  damping: 34,
  mass: 0.85,
};

/** iOS UITableView row snap */
export const SPRING_ROW = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
  mass: 0.65,
};

export const SPRING_CARD_EXIT = {
  type: "spring" as const,
  stiffness: 300,
  damping: 28,
  mass: 0.9,
};

/** Tab underline / small UI chrome */
export const SPRING_TAB = {
  type: "spring" as const,
  stiffness: 480,
  damping: 36,
  mass: 0.55,
};

/** Input focus / micro scale */
export const SPRING_MICRO = {
  type: "spring" as const,
  stiffness: 520,
  damping: 32,
  mass: 0.5,
};

export const EASE_OUT_APP = [0.32, 0.72, 0, 1] as const;

export const SWIPE_PREVIEW = 0.3;
export const SWIPE_COMMIT = 0.6;
export const MAX_ROTATE = 6;

/** Motion duration tiers (ms) */
export const MOTION_INSTANT_MS = 120;
export const MOTION_MICRO_MS = 180;
export const MOTION_COMPONENT_MS = 250;
export const MOTION_SHEET_MS = 320;

/** Standard easing curves */
export const EASE_STANDARD = [0.2, 0.8, 0.2, 1] as const;
export const EASE_EXIT = [0.4, 0, 1, 1] as const;

export function dragProgress(absPx: number, cardWidth: number) {
  return Math.min(1, absPx / (cardWidth * SWIPE_COMMIT));
}

export function indicatorScale(progress: number) {
  if (progress <= 0) return 0;
  if (progress < SWIPE_PREVIEW) return (progress / SWIPE_PREVIEW) * 0.5;
  if (progress < SWIPE_COMMIT)
    return (
      0.5 + ((progress - SWIPE_PREVIEW) / (SWIPE_COMMIT - SWIPE_PREVIEW)) * 0.5
    );
  return 1;
}

export function cardShadowBlur(progress: number) {
  return 12 + progress * 24;
}

export function cardScale(progress: number) {
  return 1 + progress * 0.03;
}
