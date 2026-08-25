import { beforeEach, describe, expect, it } from "vitest";
import {
  convertLaterInboxToSchedule,
  resetLaterInboxConvertLocksForTests,
  type ConvertLaterInboxOps,
  type LaterInboxScheduleFields,
} from "@/lib/convertLaterInboxToSchedule";
import {
  dedupeScheduleProjections,
  findScheduleProjection,
} from "@/lib/scheduleProjection";
import type { InboxItem, ScheduleItem } from "@/lib/store";

const record: InboxItem = {
  id: "canonical-1",
  text: "내일 오후 3시 치과",
  images: [],
  created_at: "2026-08-20T01:00:00.000Z",
  status: "active",
  raw_text: "내일 오후 3시 치과",
  temporal_state: "no_time",
  content_revision: 0,
};

const fields: LaterInboxScheduleFields = {
  text: "치과",
  start_time: "2026-08-21T06:00:00.000Z",
  end_time: "2026-08-21T07:00:00.000Z",
  alarm: false,
  all_day: false,
};

describe("legacy schedule projection compatibility", () => {
  beforeEach(() => {
    resetLaterInboxConvertLocksForTests();
    localStorage.clear();
  });

  it("finds legacy projection by source_id", () => {
    const legacy: ScheduleItem = {
      id: "legacy-random-uuid",
      text: "old title",
      start_time: "2026-08-20T06:00:00.000Z",
      end_time: "2026-08-20T07:00:00.000Z",
      alarm: false,
      created_at: "2026-08-20T01:00:00.000Z",
      source_id: record.id,
      status: "active",
    };
    expect(findScheduleProjection([legacy], record.id)?.id).toBe(
      "legacy-random-uuid",
    );
  });

  it("updates legacy projection in place — no duplicate", async () => {
    const state = {
      schedules: [
        {
          id: "legacy-random-uuid",
          text: "old title",
          start_time: "2026-08-20T06:00:00.000Z",
          end_time: "2026-08-20T07:00:00.000Z",
          alarm: false,
          created_at: "2026-08-20T01:00:00.000Z",
          source_id: record.id,
          status: "active" as const,
        },
      ] as ScheduleItem[],
      inbox: [{ ...record }] as InboxItem[],
    };

    const ops: ConvertLaterInboxOps = {
      addSchedule: async () => {
        throw new Error("must not create a second projection");
      },
      updateSchedule: async (id, patch) => {
        state.schedules = state.schedules.map((s) =>
          s.id === id ? { ...s, ...patch } : s,
        );
        return true;
      },
      removeSchedule: async () => true,
      getScheduleByRecordId: (id) => findScheduleProjection(state.schedules, id),
      getInboxById: (id) => state.inbox.find((i) => i.id === id),
      updateInbox: async (id, patch) => {
        state.inbox = state.inbox.map((i) =>
          i.id === id ? { ...i, ...patch } : i,
        );
        return true;
      },
    };

    const result = await convertLaterInboxToSchedule(record, fields, ops);
    expect(result).toEqual({
      status: "ok",
      scheduleId: "legacy-random-uuid",
    });
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0]).toMatchObject({
      id: "legacy-random-uuid",
      text: "치과",
      start_time: fields.start_time,
      source_id: record.id,
    });
    expect(dedupeScheduleProjections(state.schedules)).toHaveLength(1);
  });

  it("dedupes same-id + legacy source_id duplicates on read", () => {
    const rows: ScheduleItem[] = [
      {
        id: "legacy-random-uuid",
        text: "legacy",
        start_time: fields.start_time,
        end_time: fields.end_time,
        alarm: false,
        created_at: record.created_at,
        source_id: record.id,
        status: "active",
      },
      {
        id: record.id,
        text: "canonical",
        start_time: fields.start_time,
        end_time: fields.end_time,
        alarm: false,
        created_at: record.created_at,
        source_id: record.id,
        status: "active",
      },
    ];
    const deduped = dedupeScheduleProjections(rows);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe(record.id);
  });
});
