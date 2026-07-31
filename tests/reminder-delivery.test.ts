import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  shouldMarkReminderSent,
  subscriptionAlreadyDelivered,
} from "@/lib/push/reminderDelivery";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("per-device reminder delivery", () => {
  it("treats last_success_at at/after due as already delivered", () => {
    const due = "2026-07-31T10:00:00.000Z";
    expect(subscriptionAlreadyDelivered("2026-07-31T10:00:01.000Z", due)).toBe(
      true,
    );
    expect(subscriptionAlreadyDelivered("2026-07-31T09:59:56.000Z", due)).toBe(
      true,
    );
    expect(subscriptionAlreadyDelivered("2026-07-31T09:59:50.000Z", due)).toBe(
      false,
    );
    expect(subscriptionAlreadyDelivered(null, due)).toBe(false);
  });

  it("marks sent only when all devices covered, not on first Mac success", () => {
    expect(
      shouldMarkReminderSent({
        coveredCount: 1,
        activeSubscriptionCount: 2,
        attemptCount: 1,
        maxAttempts: 5,
      }),
    ).toBe(false);

    expect(
      shouldMarkReminderSent({
        coveredCount: 2,
        activeSubscriptionCount: 2,
        attemptCount: 1,
        maxAttempts: 5,
      }),
    ).toBe(true);
  });

  it("marks sent after max attempts if at least one device covered", () => {
    expect(
      shouldMarkReminderSent({
        coveredCount: 1,
        activeSubscriptionCount: 2,
        attemptCount: 5,
        maxAttempts: 5,
      }),
    ).toBe(true);

    expect(
      shouldMarkReminderSent({
        coveredCount: 0,
        activeSubscriptionCount: 2,
        attemptCount: 5,
        maxAttempts: 5,
      }),
    ).toBe(false);
  });

  it("process-reminders retries uncovered devices instead of anySuccess sent", () => {
    const cron = source("supabase/functions/process-reminders/index.ts");
    expect(cron).toContain("subscriptionAlreadyDelivered");
    expect(cron).toContain("shouldMarkReminderSent");
    expect(cron).toContain("already_delivered");
    expect(cron).toContain("last_success_at");
    expect(cron).toContain("partialRetry");
    expect(cron).not.toMatch(/if \(anySuccess\) \{\s*await supabase/);
  });

  it("test-push-ios uses durable TTL matching cron", () => {
    const edge = source("supabase/functions/test-push-ios/index.ts");
    expect(edge).toContain("TTL: 86400");
    expect(edge).not.toContain("TTL: 60");
  });
});
