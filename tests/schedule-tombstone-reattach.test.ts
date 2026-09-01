import { beforeEach, describe, expect, it } from "vitest";
import {
  convertLaterInboxToSchedule,
  resetLaterInboxConvertLocksForTests,
  type ConvertLaterInboxOps,
  type LaterInboxScheduleFields,
} from "@/lib/convertLaterInboxToSchedule";
import type { InboxItem, ScheduleItem } from "@/lib/store";

const userId = "reattach-user";
const tombstoneKey = `itjima.${userId}.tombstones`;

const item: InboxItem = {
  id: "record-reattach-1",
  text: "다시 일정 잡기",
  images: [],
  created_at: "2026-09-01T09:00:00.000Z",
  status: "active",
  raw_text: "다시 일정 잡기",
  temporal_state: "no_time",
  content_revision: 0,
};

const fields: LaterInboxScheduleFields = {
  text: "다시 일정 잡기",
  start_time: "2026-09-03T06:00:00.000Z",
  end_time: "2026-09-03T07:00:00.000Z",
  alarm: false,
  all_day: false,
  start_all_day: false,
  end_all_day: false,
  repeat: null,
};

function tombstones() {
  return JSON.parse(localStorage.getItem(tombstoneKey) || "[]") as Array<{
    id: string;
    table: string;
  }>;
}

function makeOps(options?: { createSucceeds?: boolean }): ConvertLaterInboxOps {
  const schedules: ScheduleItem[] = [];
  let inbox = { ...item };
  return {
    addSchedule: async (payload) => {
      const created = { ...payload } as ScheduleItem;
      if (options?.createSucceeds === false) {
        return { item: created, cloudSynced: false };
      }
      schedules.push(created);
      return { item: created, cloudSynced: true };
    },
    updateSchedule: async () => true,
    removeSchedule: async (id) => {
      const index = schedules.findIndex((row) => row.id === id);
      if (index >= 0) schedules.splice(index, 1);
      return true;
    },
    getScheduleByRecordId: (recordId) =>
      schedules.find((row) => row.id === recordId || row.source_id === recordId),
    getInboxById: () => inbox,
    updateInbox: async (_id, patch) => {
      inbox = { ...inbox, ...patch };
      return true;
    },
  };
}

describe("successful schedule reattach cancels stale delete intent", () => {
  beforeEach(() => {
    localStorage.clear();
    resetLaterInboxConvertLocksForTests();
    localStorage.setItem(
      tombstoneKey,
      JSON.stringify([
        {
          id: item.id,
          table: "schedules",
          userId,
          deletedAt: "2026-09-01T09:01:00.000Z",
        },
        {
          id: "other-archive",
          table: "archive",
          userId,
          deletedAt: "2026-09-01T09:01:00.000Z",
        },
      ]),
    );
  });

  it("removes the stale schedule tombstone only after a successful projection write", async () => {
    const result = await convertLaterInboxToSchedule(item, fields, makeOps());

    expect(result).toEqual({ status: "ok", scheduleId: item.id });
    expect(
      tombstones().some((row) => row.id === item.id && row.table === "schedules"),
    ).toBe(false);
    expect(
      tombstones().some(
        (row) => row.id === "other-archive" && row.table === "archive",
      ),
    ).toBe(true);
  });

  it("keeps the stale delete intent when projection creation fails", async () => {
    const result = await convertLaterInboxToSchedule(
      item,
      fields,
      makeOps({ createSucceeds: false }),
    );

    expect(result).toEqual({ status: "create_failed" });
    expect(
      tombstones().some((row) => row.id === item.id && row.table === "schedules"),
    ).toBe(true);
  });
});
