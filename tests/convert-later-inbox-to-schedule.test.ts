import { beforeEach, describe, expect, it } from "vitest";
import {
  convertLaterInboxToSchedule,
  laterInboxScheduleDraftTitle,
  resetLaterInboxConvertLocksForTests,
  undoScheduleToInbox,
  type ConvertLaterInboxOps,
  type LaterInboxScheduleFields,
} from "@/lib/convertLaterInboxToSchedule";
import type { InboxItem, ScheduleItem } from "@/lib/store";

const laterItem: InboxItem = {
  id: "later-1",
  text: "엄마한테 전화하기\n저녁에",
  images: [],
  created_at: "2026-08-20T01:00:00.000Z",
  status: "active",
  decision: "later",
  decided_at: "2026-08-20T01:05:00.000Z",
  raw_text: "엄마한테 전화하기\n저녁에",
  temporal_state: "no_time",
};

const fields: LaterInboxScheduleFields = {
  text: "엄마한테 전화하기",
  start_time: "2026-08-21T06:00:00.000Z",
  end_time: "2026-08-21T07:00:00.000Z",
  alarm: false,
  all_day: false,
  start_all_day: false,
  end_all_day: false,
  repeat: null,
};

function mockOps(overrides: Partial<ConvertLaterInboxOps> = {}) {
  const state = {
    schedules: [] as ScheduleItem[],
    inbox: [{ ...laterItem }] as InboxItem[],
  };

  const base: ConvertLaterInboxOps = {
    addSchedule: async (payload) => {
      const item = {
        id: payload.id ?? `sched-${state.schedules.length + 1}`,
        created_at: new Date().toISOString(),
        ...payload,
      } as ScheduleItem;
      state.schedules.push(item);
      return { item, cloudSynced: true };
    },
    updateSchedule: async (id, patch) => {
      state.schedules = state.schedules.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      );
      return true;
    },
    removeSchedule: async (id) => {
      state.schedules.splice(
        0,
        state.schedules.length,
        ...state.schedules.filter((s) => s.id !== id),
      );
      return true;
    },
    getScheduleByRecordId: (recordId) =>
      state.schedules.find((s) => s.id === recordId || s.source_id === recordId),
    getInboxById: (recordId) => state.inbox.find((i) => i.id === recordId),
    updateInbox: async (id, patch) => {
      state.inbox = state.inbox.map((i) =>
        i.id === id ? { ...i, ...patch } : i,
      );
      return true;
    },
  };

  return {
    state,
    ops: { ...base, ...overrides },
  };
}

describe("M1 canonical record + schedule projection", () => {
  beforeEach(() => {
    resetLaterInboxConvertLocksForTests();
    localStorage.clear();
  });

  it("opens with the existing inbox text as the schedule draft title", () => {
    expect(laterInboxScheduleDraftTitle(laterItem)).toBe("엄마한테 전화하기");
  });

  it("on success creates projection with same id and keeps the inbox record", async () => {
    const { state, ops } = mockOps();
    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);

    expect(result).toEqual({ status: "ok", scheduleId: laterItem.id });
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0]).toMatchObject({
      id: laterItem.id,
      text: "엄마한테 전화하기",
      source_id: laterItem.id,
      raw_text: laterItem.text,
    });
    expect(state.inbox).toHaveLength(1);
    expect(state.inbox[0]).toMatchObject({
      id: laterItem.id,
      temporal_state: "exact_datetime",
      start_time: fields.start_time,
      end_time: fields.end_time,
      clarification_state: "resolved",
    });
    expect(state.inbox[0].structured_at).toBeTruthy();
  });

  it("keeps the inbox item when schedule create fails (cloudSynced false)", async () => {
    const { state, ops } = mockOps({
      addSchedule: async (payload) => {
        const item = { id: payload.id ?? "sched-fail", ...payload } as ScheduleItem;
        return { item, cloudSynced: false };
      },
    });

    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);

    expect(result).toEqual({ status: "create_failed" });
    expect(state.inbox).toEqual([expect.objectContaining({ id: laterItem.id })]);
    expect(state.schedules).toHaveLength(0);
  });

  it("keeps the inbox item when schedule create throws", async () => {
    const { state, ops } = mockOps({
      addSchedule: async () => {
        throw new Error("network");
      },
    });

    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);

    expect(result).toEqual({ status: "create_failed" });
    expect(state.inbox).toHaveLength(1);
    expect(state.schedules).toHaveLength(0);
  });

  it("rolls back the projection when inbox temporal attach returns false", async () => {
    const { state, ops } = mockOps({
      updateInbox: async () => false,
    });

    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);

    expect(result).toEqual({ status: "attach_failed_rolled_back" });
    expect(state.schedules).toHaveLength(0);
    expect(state.inbox).toEqual([
      expect.objectContaining({ id: laterItem.id, text: laterItem.text }),
    ]);
  });

  it("rolls back when inbox update throws after projection create", async () => {
    const { state, ops } = mockOps({
      updateInbox: async () => {
        throw new Error("cloud update failed");
      },
    });

    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);

    expect(result).toEqual({ status: "attach_failed_rolled_back" });
    expect(state.schedules).toHaveLength(0);
    expect(state.inbox).toEqual([
      expect.objectContaining({ id: laterItem.id }),
    ]);
  });

  it("updates existing projection instead of creating a duplicate", async () => {
    const { state, ops } = mockOps();
    state.schedules = [
      {
        id: laterItem.id,
        text: "old",
        start_time: "2026-08-20T06:00:00.000Z",
        end_time: "2026-08-20T07:00:00.000Z",
        alarm: false,
        created_at: "2026-08-20T01:00:00.000Z",
        source_id: laterItem.id,
        status: "active",
      },
    ];

    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);
    expect(result).toEqual({ status: "ok", scheduleId: laterItem.id });
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0].text).toBe("엄마한테 전화하기");
    expect(state.schedules[0].start_time).toBe(fields.start_time);
  });

  it("does not create duplicate projections on concurrent taps", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const { state, ops } = mockOps({
      addSchedule: async (payload) => {
        await gate;
        const item = {
          id: payload.id ?? `sched-${state.schedules.length + 1}`,
          created_at: new Date().toISOString(),
          ...payload,
        } as ScheduleItem;
        state.schedules.push(item);
        return { item, cloudSynced: true };
      },
    });

    const first = convertLaterInboxToSchedule(laterItem, fields, ops);
    const second = convertLaterInboxToSchedule(laterItem, fields, ops);

    release();
    const [a, b] = await Promise.all([first, second]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["busy", "ok"]);
    expect(state.schedules).toHaveLength(1);
    expect(state.inbox).toHaveLength(1);
  });

  it("never deletes inbox — order is projection then attach temporal", async () => {
    const order: string[] = [];
    const { state, ops } = mockOps({
      addSchedule: async (payload) => {
        order.push("add");
        await new Promise((r) => setTimeout(r, 5));
        const item = {
          id: payload.id ?? "sched-1",
          created_at: new Date().toISOString(),
          ...payload,
        } as ScheduleItem;
        state.schedules.push(item);
        return { item, cloudSynced: true };
      },
      updateInbox: async (id, patch) => {
        order.push("update-inbox");
        state.inbox = state.inbox.map((i) =>
          i.id === id ? { ...i, ...patch } : i,
        );
        return true;
      },
    });

    await convertLaterInboxToSchedule(laterItem, fields, ops);
    expect(order).toEqual(["add", "update-inbox"]);
    expect(state.inbox).toHaveLength(1);
  });

  it("guest / local-only success keeps canonical record + projection", async () => {
    const { state, ops } = mockOps();
    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);
    expect(result).toEqual({ status: "ok", scheduleId: laterItem.id });
    expect(state.schedules).toHaveLength(1);
    expect(state.inbox).toHaveLength(1);
  });
});

describe("M1 undo timed attach (clear projection, keep record)", () => {
  beforeEach(() => {
    resetLaterInboxConvertLocksForTests();
    localStorage.clear();
  });

  it("removes projection and clears temporal metadata without deleting inbox", async () => {
    const { state, ops } = mockOps();
    const created = await convertLaterInboxToSchedule(laterItem, fields, ops);
    expect(created.status).toBe("ok");
    if (created.status !== "ok") return;

    const undone = await undoScheduleToInbox(
      created.scheduleId,
      laterItem,
      fields,
      ops,
    );

    expect(undone).toEqual({ status: "ok" });
    expect(state.schedules).toHaveLength(0);
    expect(state.inbox).toEqual([
      expect.objectContaining({
        id: laterItem.id,
        text: laterItem.text,
        temporal_state: "no_time",
        start_time: null,
        end_time: null,
        clarification_state: "dismissed",
      }),
    ]);
  });

  it("recreates projection if clearing temporal fails after schedule delete", async () => {
    const { state, ops } = mockOps({
      updateInbox: async () => {
        throw new Error("clear failed");
      },
    });
    state.schedules = [
      {
        id: laterItem.id,
        text: fields.text,
        start_time: fields.start_time,
        end_time: fields.end_time,
        alarm: false,
        created_at: laterItem.created_at,
        source_id: laterItem.id,
        status: "active",
      },
    ];

    const undone = await undoScheduleToInbox(
      laterItem.id,
      laterItem,
      fields,
      ops,
    );

    expect(undone.status).toBe("restore_failed_schedule_recreated");
    if (undone.status === "restore_failed_schedule_recreated") {
      expect(undone.scheduleId).toBeTruthy();
    }
    expect(state.schedules.length).toBeGreaterThanOrEqual(1);
    expect(state.inbox).toHaveLength(1);
  });
});
