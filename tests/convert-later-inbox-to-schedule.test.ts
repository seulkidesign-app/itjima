import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  convertLaterInboxToSchedule,
  laterInboxScheduleDraftTitle,
  resetLaterInboxConvertLocksForTests,
  type ConvertLaterInboxOps,
  type LaterInboxScheduleFields,
} from "@/lib/convertLaterInboxToSchedule";
import type { InboxItem } from "@/lib/store";

const laterItem: InboxItem = {
  id: "later-1",
  text: "엄마한테 전화하기\n저녁에",
  images: [],
  created_at: "2026-08-20T01:00:00.000Z",
  status: "active",
  decision: "later",
  decided_at: "2026-08-20T01:05:00.000Z",
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
    schedules: [] as { id: string; text?: string; source_id?: string; raw_text?: string }[],
    inbox: [{ ...laterItem }] as InboxItem[],
  };

  const base: ConvertLaterInboxOps = {
    addSchedule: async (payload) => {
      const item = { id: `sched-${state.schedules.length + 1}`, ...payload };
      state.schedules.push(item);
      return { item, cloudSynced: true };
    },
    removeSchedule: async (id) => {
      state.schedules.splice(
        0,
        state.schedules.length,
        ...state.schedules.filter((s) => s.id !== id),
      );
      return true;
    },
    removeInbox: async (id) => {
      state.inbox.splice(
        0,
        state.inbox.length,
        ...state.inbox.filter((i) => i.id !== id),
      );
      return true;
    },
    restoreInbox: async (item) => {
      if (!state.inbox.some((i) => i.id === item.id)) {
        state.inbox.push({ ...item });
      }
    },
  };

  return {
    state,
    ops: { ...base, ...overrides },
  };
}

describe("V02-04 later inbox → schedule convert", () => {
  beforeEach(() => {
    resetLaterInboxConvertLocksForTests();
    localStorage.clear();
  });

  it("opens with the existing inbox text as the schedule draft title", () => {
    expect(laterInboxScheduleDraftTitle(laterItem)).toBe("엄마한테 전화하기");
  });

  it("on success creates one schedule and removes the inbox original", async () => {
    const { state, ops } = mockOps();
    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);

    expect(result).toEqual({ status: "ok", scheduleId: "sched-1" });
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0]).toMatchObject({
      text: "엄마한테 전화하기",
      source_id: laterItem.id,
      raw_text: laterItem.text,
    });
    expect(state.inbox).toHaveLength(0);
  });

  it("keeps the inbox item when schedule create fails (cloudSynced false)", async () => {
    const { state, ops } = mockOps({
      addSchedule: async (payload) => {
        const item = { id: "sched-fail", ...payload };
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

  it("rolls back the schedule and restores inbox when remove returns false", async () => {
    const { state, ops } = mockOps({
      removeInbox: async () => false,
    });

    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);

    expect(result).toEqual({ status: "remove_failed_rolled_back" });
    expect(state.schedules).toHaveLength(0);
    expect(state.inbox).toEqual([
      expect.objectContaining({ id: laterItem.id, text: laterItem.text }),
    ]);
  });

  it("rolls back when inbox remove throws after a local delete", async () => {
    const { state, ops } = mockOps({
      removeInbox: async (id) => {
        state.inbox.splice(
          0,
          state.inbox.length,
          ...state.inbox.filter((i) => i.id !== id),
        );
        throw new Error("cloud delete failed");
      },
    });

    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);

    expect(result).toEqual({ status: "remove_failed_rolled_back" });
    expect(state.schedules).toHaveLength(0);
    expect(state.inbox).toEqual([
      expect.objectContaining({ id: laterItem.id }),
    ]);
  });

  it("does not create duplicate schedules on concurrent taps", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const { state, ops } = mockOps({
      addSchedule: async (payload) => {
        await gate;
        const item = { id: `sched-${state.schedules.length + 1}`, ...payload };
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
    expect(state.inbox).toHaveLength(0);
  });

  it("never removes inbox before schedule create resolves", async () => {
    const order: string[] = [];
    const { state, ops } = mockOps({
      addSchedule: async (payload) => {
        order.push("add");
        await new Promise((r) => setTimeout(r, 5));
        const item = { id: "sched-1", ...payload };
        state.schedules.push(item);
        return { item, cloudSynced: true };
      },
      removeInbox: async (id) => {
        order.push("remove-inbox");
        state.inbox.splice(
          0,
          state.inbox.length,
          ...state.inbox.filter((i) => i.id !== id),
        );
        return true;
      },
    });

    await convertLaterInboxToSchedule(laterItem, fields, ops);
    expect(order).toEqual(["add", "remove-inbox"]);
  });

  it("offline / cloud unreachable: create fails and preserves the original inbox record", async () => {
    const { state, ops } = mockOps({
      addSchedule: async () => {
        // Confirmed mutation rolled back locally after cloud timeout/offline.
        return { item: { id: "never-persisted" }, cloudSynced: false };
      },
    });

    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);

    expect(result).toEqual({ status: "create_failed" });
    expect(state.inbox).toEqual([
      expect.objectContaining({ id: laterItem.id, text: laterItem.text }),
    ]);
    expect(state.schedules).toHaveLength(0);
  });

  it("unstable network: create succeeds then remove fails → no duplicate, inbox restored", async () => {
    const { state, ops } = mockOps({
      removeInbox: async () => {
        // Local delete happened; cloud delete flaked.
        state.inbox.splice(0, state.inbox.length);
        return false;
      },
    });

    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);

    expect(result).toEqual({ status: "remove_failed_rolled_back" });
    expect(state.schedules).toHaveLength(0);
    expect(state.inbox).toEqual([
      expect.objectContaining({ id: laterItem.id, text: laterItem.text }),
    ]);
  });

  it("guest / local-only success stays local-first (cloudSynced true without awaiting)", async () => {
    const { state, ops } = mockOps({
      addSchedule: async (payload) => {
        const item = { id: "local-sched", ...payload };
        state.schedules.push(item);
        // Guest path: store returns cloudSynced true immediately after local write.
        return { item, cloudSynced: true };
      },
    });

    const result = await convertLaterInboxToSchedule(laterItem, fields, ops);
    expect(result).toEqual({ status: "ok", scheduleId: "local-sched" });
    expect(state.schedules).toHaveLength(1);
    expect(state.inbox).toHaveLength(0);
  });
});

describe("V02-08C undo schedule → inbox", () => {
  beforeEach(() => {
    resetLaterInboxConvertLocksForTests();
    localStorage.clear();
  });

  it("removes schedule and restores raw inbox without duplicates", async () => {
    const { state, ops } = mockOps();
    const created = await convertLaterInboxToSchedule(laterItem, fields, ops);
    expect(created.status).toBe("ok");
    if (created.status !== "ok") return;

    const { undoScheduleToInbox } = await import(
      "@/lib/convertLaterInboxToSchedule"
    );
    const undone = await undoScheduleToInbox(
      created.scheduleId,
      laterItem,
      fields,
      ops,
    );

    expect(undone).toEqual({ status: "ok" });
    expect(state.schedules).toHaveLength(0);
    expect(state.inbox).toEqual([
      expect.objectContaining({ id: laterItem.id, text: laterItem.text }),
    ]);
  });

  it("recreates schedule if inbox restore fails after schedule delete", async () => {
    const { state, ops } = mockOps({
      restoreInbox: async () => {
        throw new Error("restore failed");
      },
    });
    state.inbox = [];
    state.schedules = [{ id: "sched-1" }];

    const { undoScheduleToInbox } = await import(
      "@/lib/convertLaterInboxToSchedule"
    );
    const undone = await undoScheduleToInbox(
      "sched-1",
      laterItem,
      fields,
      ops,
    );

    expect(undone.status).toBe("restore_failed_schedule_recreated");
    if (undone.status === "restore_failed_schedule_recreated") {
      expect(undone.scheduleId).toBeTruthy();
    }
    expect(state.schedules.length).toBeGreaterThanOrEqual(1);
    expect(state.inbox).toHaveLength(0);
  });
});
