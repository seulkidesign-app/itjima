/** iOS-native motion tokens — transform/opacity only, GPU-composited. */

export const MOTION_EASE = [0.22, 1, 0.36, 1] as const;
export const MOTION_EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
export const MOTION_DURATION = 0.24;
export const MOTION_DURATION_FAST = 0.14;
export const MOTION_DURATION_SLOW = 0.36;

export const TRANSITION_CALM = {
  duration: MOTION_DURATION,
  ease: MOTION_EASE,
} as const;

export const TRANSITION_CALM_SLOW = {
  duration: MOTION_DURATION_SLOW,
  ease: MOTION_EASE,
} as const;

export const TRANSITION_FAST = {
  duration: MOTION_DURATION_FAST,
  ease: MOTION_EASE,
} as const;

/** Gesture spring — stiffness ~320 / damping ~30, velocity-aware. */
export const SPRING_DEFAULT = {
  type: "spring" as const,
  stiffness: 320,
  damping: 30,
  mass: 0.85,
};

export const SPRING_SNAP_BACK = {
  type: "spring" as const,
  stiffness: 320,
  damping: 30,
  mass: 0.82,
};

export const SPRING_SHEET = {
  type: "spring" as const,
  stiffness: 320,
  damping: 30,
  mass: 0.9,
};

/** iOS UITableView row snap */
export const SPRING_ROW = {
  type: "spring" as const,
  stiffness: 320,
  damping: 30,
  mass: 0.7,
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
  stiffness: 380,
  damping: 32,
  mass: 0.55,
};

/** Input focus / micro scale */
export const SPRING_MICRO = {
  type: "spring" as const,
  stiffness: 320,
  damping: 30,
  mass: 0.55,
};

export const EASE_OUT_APP = MOTION_EASE;

export const SWIPE_PREVIEW = 0.3;
export const SWIPE_COMMIT = 0.6;
/** Tinder-style max tilt during drag. */
export const MAX_ROTATE = 12;

/** Motion duration tiers (ms) — mirror CSS --dur-* */
export const MOTION_INSTANT_MS = 140;
export const MOTION_MICRO_MS = 140;
export const MOTION_COMPONENT_MS = 240;
export const MOTION_SHEET_MS = 360;
export const MOTION_FAST_MS = 140;
export const MOTION_BASE_MS = 240;
export const MOTION_SLOW_MS = 360;

/** Shared sheet backdrop for consumers that animate opacity 0→1. */
export const SHEET_BACKDROP_CLASS = "bg-ink/40";

/** Solid ink for proportional dim (opacity driven to SHEET_DIM_MAX). */
export const SHEET_BACKDROP_SOLID_CLASS = "bg-ink";

export const SHEET_BACKDROP_FADE = {
  duration: MOTION_DURATION_SLOW,
  ease: EASE_OUT_APP,
} as const;

/** Max backdrop dim while sheet is fully open (0 → 0.4). */
export const SHEET_DIM_MAX = 0.4;

export const EASE_STANDARD = MOTION_EASE;
export const EASE_EXIT = MOTION_EASE_IN_OUT;

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
  return 8 + progress * 16;
}

export function cardScale(progress: number) {
  return 1 + progress * 0.02;
}
