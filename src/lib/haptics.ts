/** Lightweight haptic helper. Safe on devices/browsers without vibration. */
export function haptic(pattern: number | number[] = 10) {
  if (typeof navigator === "undefined") return;
  const vibrate = navigator.vibrate?.bind(navigator);
  if (!vibrate) return;
  try {
    vibrate(pattern);
  } catch {
    // ignore
  }
}

export const tap = () => haptic(8);
export const tick = () => haptic(4);
export const confirm = () => haptic([12, 30, 18]);
export const light = () => haptic(6);
export const rigid = () => haptic([4, 8]);

let lastTickAt = 0;

/** Avoid over-vibrating during continuous drag (ChatSwipeRow, SwipeCard). */
export function tickDebounced(minMs = 72) {
  const now = Date.now();
  if (now - lastTickAt < minMs) return;
  lastTickAt = now;
  tick();
}
