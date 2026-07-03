/** Apple-style spring presets for ItJima interaction system v1.0 */
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

export const SWIPE_PREVIEW = 0.3;
export const SWIPE_COMMIT = 0.6;
export const MAX_ROTATE = 8;

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
