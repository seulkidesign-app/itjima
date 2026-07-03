import { test, expect } from "@playwright/test";
import {
  mergeCloudRow,
  shouldPreferLocalInboxStatus,
} from "../src/lib/cloudMerge";

test.describe("cloud merge (sync tombstones)", () => {
  test("prefers local deleted over cloud active", () => {
    expect(shouldPreferLocalInboxStatus("deleted", "active")).toBe(true);
    expect(shouldPreferLocalInboxStatus("deleted", undefined)).toBe(true);
    expect(shouldPreferLocalInboxStatus("active", "deleted")).toBe(false);
  });

  test("mergeCloudRow keeps local deleted status", () => {
    const cloud = {
      id: "a",
      text: "hello",
      status: "active" as const,
      created_at: "2026-01-01T00:00:00Z",
    };
    const local = { ...cloud, status: "deleted" as const };
    const merged = mergeCloudRow(cloud, local, "inbox");
    expect(merged.status).toBe("deleted");
  });

  test("mergeCloudRow keeps local brain_mirror when cloud lacks it", () => {
    const mirror = {
      summary: "test",
      action: null,
      mood: null,
      tags: [],
    };
    const cloud = {
      id: "b",
      text: "hello",
      created_at: "2026-01-01T00:00:00Z",
    };
    const local = { ...cloud, brain_mirror: mirror };
    const merged = mergeCloudRow(cloud, local, "inbox");
    expect(merged.brain_mirror).toEqual(mirror);
  });

  test("mergeCloudRow preserves schedule done status", () => {
    const cloud = {
      id: "s",
      text: "task",
      status: "active" as const,
      start_time: "2026-01-01T09:00:00Z",
      end_time: "2026-01-01T10:00:00Z",
    };
    const local = { ...cloud, status: "done" as const };
    const merged = mergeCloudRow(cloud, local, "schedules");
    expect(merged.status).toBe("done");
  });
});
