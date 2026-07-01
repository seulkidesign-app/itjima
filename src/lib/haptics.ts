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
