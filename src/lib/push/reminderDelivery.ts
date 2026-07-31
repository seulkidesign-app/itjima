/** Skip re-push if this subscription already succeeded at/after due time. */
export const ALREADY_DELIVERED_SLACK_MS = 5_000;

/** True if this device already got a push for this reminder's due window. */
export function subscriptionAlreadyDelivered(
  lastSuccessAt: string | null | undefined,
  dueAtUtc: string,
): boolean {
  if (!lastSuccessAt) return false;
  const successMs = Date.parse(lastSuccessAt);
  const dueMs = Date.parse(dueAtUtc);
  if (!Number.isFinite(successMs) || !Number.isFinite(dueMs)) return false;
  return successMs >= dueMs - ALREADY_DELIVERED_SLACK_MS;
}

/**
 * Mark reminder sent only when every active device is covered,
 * or after max attempts if at least one device was covered.
 */
export function shouldMarkReminderSent(options: {
  coveredCount: number;
  activeSubscriptionCount: number;
  attemptCount: number;
  maxAttempts: number;
}): boolean {
  const { coveredCount, activeSubscriptionCount, attemptCount, maxAttempts } =
    options;
  if (activeSubscriptionCount <= 0) return false;
  if (coveredCount >= activeSubscriptionCount) return true;
  return attemptCount >= maxAttempts && coveredCount > 0;
}
