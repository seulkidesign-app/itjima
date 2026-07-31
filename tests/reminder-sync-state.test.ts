import { beforeEach, describe, expect, it } from "vitest";
import {
  buildReminderUpsert,
  rememberReminderSyncResult,
  wasRecentReminderSyncFailure,
} from "@/lib/push/scheduledRemindersSync";
import type { ScheduleItem } from "@/lib/store";

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

  it("does not queue a server reminder when alarm_at is already past", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const schedule = {
      id: "s-past",
      text: "지난 알림",
      start_time: past,
      end_time: past,
      alarm: true,
      alarm_at: past,
      created_at: past,
    } as ScheduleItem;
    expect(buildReminderUpsert("user-1", schedule)).toBeNull();
  });

  it("queues a server reminder for a future alarm_at", () => {
    const future = new Date(Date.now() + 600_000).toISOString();
    const schedule = {
      id: "s-future",
      text: "미래 알림",
      start_time: future,
      end_time: future,
      alarm: true,
      alarm_at: future,
      created_at: future,
    } as ScheduleItem;
    const row = buildReminderUpsert("user-1", schedule);
    expect(row?.due_at_utc).toBe(future);
    expect(row?.status).toBe("pending");
  });
});
