import { beforeEach, describe, expect, it } from "vitest";
import {
  rememberReminderSyncResult,
  wasRecentReminderSyncFailure,
} from "@/lib/push/scheduledRemindersSync";

describe("reminder server sync state", () => {
  beforeEach(() => {
    sessionStorage.clear();
    rememberReminderSyncResult(true, 0);
  });

  it("marks a fresh server failure as in-app-only", () => {
    rememberReminderSyncResult(false, 10_000);
    expect(wasRecentReminderSyncFailure(10_001)).toBe(true);
  });

  it("clears the failure as soon as a later sync succeeds", () => {
    rememberReminderSyncResult(false, 10_000);
    rememberReminderSyncResult(true, 10_100);
    expect(wasRecentReminderSyncFailure(10_101)).toBe(false);
  });

  it("does not keep an old failure forever", () => {
    rememberReminderSyncResult(false, 10_000);
    expect(wasRecentReminderSyncFailure(40_001)).toBe(false);
  });
});
