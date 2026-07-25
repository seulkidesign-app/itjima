const inFlight = new Set<string>();

/** Prevent duplicate schedule/task/archive commits from double-taps. */
export async function withNlConfirmGuard(
  itemId: string,
  run: () => void | Promise<void>,
): Promise<boolean> {
  if (inFlight.has(itemId)) return false;
  inFlight.add(itemId);
  try {
    await run();
    return true;
  } finally {
    inFlight.delete(itemId);
  }
}

export function isNlConfirmInFlight(itemId: string): boolean {
  return inFlight.has(itemId);
}
