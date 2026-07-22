import { expect, test } from "@playwright/test";
import { suggestResurfaceTime } from "../src/lib/dateDetect";
import { dueSchedules } from "../src/lib/todaySuggestions";
import {
  reconcileLegacyMemory,
  resolveRemovedLegacyMemory,
  type Memory,
} from "../src/lib/memory";
import type { ArchiveItem, InboxItem, ScheduleItem } from "../src/lib/store";

const TIMEZONE = "Asia/Seoul";

function inboxItem(id = "inbox-1"): InboxItem {
  return {
    id,
    text: "내일 오후 3시 병원 서류 챙기기",
    images: ["receipt.jpg"],
    created_at: "2026-07-22T10:00:00.000Z",
    status: "active",
  };
}

function scheduleItem(
  start = "2026-07-23T06:00:00.000Z",
  id = "schedule-1",
): ScheduleItem {
  return {
    id,
    text: "병원 서류 챙기기",
    images: ["receipt.jpg"],
    start_time: start,
    end_time: new Date(
      new Date(start).getTime() + 60 * 60 * 1000,
    ).toISOString(),
    alarm: false,
    created_at: "2026-07-22T10:01:00.000Z",
    source_id: "inbox-1",
    raw_text: "내일 오후 3시 병원 서류 챙기기",
    status: "active",
  };
}

function archiveItem(
  id = "archive-1",
  resolution?: "completed" | "no_longer_needed",
): ArchiveItem {
  return {
    id,
    text: "내일 오후 3시 병원 서류 챙기기",
    images: [],
    created_at: "2026-07-23T07:00:00.000Z",
    source_id: "inbox-1",
    resolution_kind: resolution,
  };
}

test.describe("Personal alpha timing suggestion", () => {
  test("date-free capture suggests tomorrow at 09:00 without AI", () => {
    const now = new Date("2026-07-22T11:30:00.000Z");
    const suggestion = suggestResurfaceTime("언젠가 포트폴리오 정리", now);
    expect(suggestion.source).toBe("default");
    expect(suggestion.start.getFullYear()).toBe(2026);
    expect(suggestion.start.getMonth()).toBe(6);
    expect(suggestion.start.getDate()).toBe(23);
    expect(suggestion.start.getHours()).toBe(9);
    expect(suggestion.start.getMinutes()).toBe(0);
  });

  test("natural-language time wins over the calm default", () => {
    const now = new Date("2026-07-22T11:30:00.000Z");
    const suggestion = suggestResurfaceTime("내일 오후 3시 병원", now);
    expect(suggestion.source).toBe("detected");
    expect(suggestion.start.getDate()).toBe(23);
    expect(suggestion.start.getHours()).toBe(15);
  });

  test("day after tomorrow is not mistaken for tomorrow", () => {
    const now = new Date("2026-07-22T11:30:00.000Z");
    const suggestion = suggestResurfaceTime("day after tomorrow at 3pm", now);
    expect(suggestion.start.getDate()).toBe(24);
    expect(suggestion.start.getHours()).toBe(15);
  });

  test("an absolute date later today does not jump to next year", () => {
    const now = new Date("2026-07-22T11:30:00.000Z");
    const suggestion = suggestResurfaceTime("7/22에 다시 보기", now);
    expect(suggestion.start.getFullYear()).toBe(2026);
    expect(suggestion.start.getDate()).toBe(22);
    expect(suggestion.start.getTime()).toBeGreaterThan(now.getTime());
  });
});

test.describe("Today resurfacing", () => {
  test("exact and long-overdue thoughts remain due while future thoughts stay hidden", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");
    const overdue = scheduleItem("2026-07-19T12:00:00.000Z", "overdue");
    const exact = scheduleItem(now.toISOString(), "exact");
    const future = scheduleItem("2026-07-22T12:01:00.000Z", "future");

    expect(
      dueSchedules([future, exact, overdue], new Set(), now).map(
        (item) => item.id,
      ),
    ).toEqual(["overdue", "exact"]);
    expect(dueSchedules([future], new Set(["future"]), now)).toHaveLength(1);
  });
});

test.describe("Legacy UI → canonical Memory compatibility", () => {
  test("capture → schedule reuses one canonical memory", () => {
    const captured = reconcileLegacyMemory([], "inbox", inboxItem(), TIMEZONE);
    const waiting = reconcileLegacyMemory(
      captured.memories,
      "schedule",
      scheduleItem(),
      TIMEZONE,
    );

    expect(waiting.memories).toHaveLength(1);
    expect(waiting.memory.id).toBe("inbox-1");
    expect(waiting.memory.status).toBe("waiting");
    expect(waiting.memory.provenance?.legacy_source).toBe("schedule");
    expect(waiting.memory.provenance?.source_id).toBe("inbox-1");
    expect(waiting.memory.content.images).toEqual(["receipt.jpg"]);
  });

  test("snooze stores the new moment and increments count", () => {
    const captured = reconcileLegacyMemory([], "inbox", inboxItem(), TIMEZONE);
    const waiting = reconcileLegacyMemory(
      captured.memories,
      "schedule",
      scheduleItem(),
      TIMEZONE,
    );
    const nextStart = "2026-07-24T06:00:00.000Z";
    const snoozed = reconcileLegacyMemory(
      waiting.memories,
      "schedule",
      scheduleItem(nextStart),
      TIMEZONE,
      "snooze",
    );

    expect(snoozed.memory.status).toBe("waiting");
    expect(snoozed.memory.resurface_at).toBe(nextStart);
    expect(snoozed.memory.snooze_count).toBe(1);
  });

  test("first snooze is counted even when canonical migration missed the cloud row", () => {
    const snoozed = reconcileLegacyMemory(
      [],
      "schedule",
      scheduleItem("2026-07-24T06:00:00.000Z"),
      TIMEZONE,
      "snooze",
    );

    expect(snoozed.memory.status).toBe("waiting");
    expect(snoozed.memory.snooze_count).toBe(1);
  });

  test("completion remains resolved after copying into Archive", () => {
    const captured = reconcileLegacyMemory([], "inbox", inboxItem(), TIMEZONE);
    const waiting = reconcileLegacyMemory(
      captured.memories,
      "schedule",
      scheduleItem(),
      TIMEZONE,
    );
    const completedSchedule = {
      ...scheduleItem(),
      status: "done" as const,
    };
    const resolved = reconcileLegacyMemory(
      waiting.memories,
      "schedule",
      completedSchedule,
      TIMEZONE,
      "completed",
    );
    const archived = reconcileLegacyMemory(
      resolved.memories,
      "archive",
      archiveItem("archive-1", "completed"),
      TIMEZONE,
      "completed",
    );

    expect(archived.memories).toHaveLength(1);
    expect(archived.memory.status).toBe("resolved");
    expect(archived.memory.resolution_kind).toBe("completed");
    expect(archived.memory.provenance?.legacy_source).toBe("archive");
    expect(archived.memory.content.images).toEqual(["receipt.jpg"]);

    const removedArchive = resolveRemovedLegacyMemory(
      archived.memories,
      "archive",
      archiveItem("archive-1", "completed").id,
    );
    expect(removedArchive?.memory.resolution_kind).toBe("completed");
  });

  test("archive-only capture becomes kept", () => {
    const captured = reconcileLegacyMemory([], "inbox", inboxItem(), TIMEZONE);
    const kept = reconcileLegacyMemory(
      captured.memories,
      "archive",
      archiveItem(),
      TIMEZONE,
    );
    expect(kept.memories).toHaveLength(1);
    expect(kept.memory.status).toBe("kept");
  });

  test("resolved Archive metadata can rebuild canonical completion state", () => {
    const recovered = reconcileLegacyMemory(
      [],
      "archive",
      archiveItem("resolved-archive", "completed"),
      TIMEZONE,
    );
    expect(recovered.memory.status).toBe("resolved");
    expect(recovered.memory.resolution_kind).toBe("completed");
  });

  test("removing the old bucket after a move does not resolve the memory", () => {
    const captured = reconcileLegacyMemory([], "inbox", inboxItem(), TIMEZONE);
    const waiting = reconcileLegacyMemory(
      captured.memories,
      "schedule",
      scheduleItem(),
      TIMEZONE,
    );
    const removed = resolveRemovedLegacyMemory(
      waiting.memories,
      "inbox",
      "inbox-1",
    );
    expect(removed).toBeNull();
    expect((waiting.memories[0] as Memory).status).toBe("waiting");
  });

  test("unrelated live items with the same legacy id keep distinct canonical ids", () => {
    const captured = reconcileLegacyMemory(
      [],
      "inbox",
      inboxItem("shared-id"),
      TIMEZONE,
    );
    const unrelatedArchive: ArchiveItem = {
      ...archiveItem("shared-id"),
      source_id: null,
    };
    const kept = reconcileLegacyMemory(
      captured.memories,
      "archive",
      unrelatedArchive,
      TIMEZONE,
    );

    expect(kept.memories).toHaveLength(2);
    expect(new Set(kept.memories.map((memory) => memory.id)).size).toBe(2);
  });

  test("duplicating a schedule creates a distinct canonical memory", () => {
    const captured = reconcileLegacyMemory([], "inbox", inboxItem(), TIMEZONE);
    const waiting = reconcileLegacyMemory(
      captured.memories,
      "schedule",
      scheduleItem(),
      TIMEZONE,
    );
    const copy = reconcileLegacyMemory(
      waiting.memories,
      "schedule",
      scheduleItem("2026-07-24T06:00:00.000Z", "schedule-copy"),
      TIMEZONE,
      "copy",
    );

    expect(copy.memories).toHaveLength(2);
    expect(new Set(copy.memories.map((memory) => memory.id)).size).toBe(2);
    expect(copy.memory.status).toBe("waiting");
  });
});
