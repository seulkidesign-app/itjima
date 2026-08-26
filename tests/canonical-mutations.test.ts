import { describe, expect, it } from "vitest";
import {
  completeRecord,
  deleteRecord,
  syncRecordTemporal,
  syncRecordText,
  undoCompleteRecord,
  undoDeleteRecord,
  type CanonicalMutationOps,
} from "@/lib/canonicalMutations";
import type { InboxItem, ScheduleItem } from "@/lib/store";

function makeOps(seed?: {
  inbox?: InboxItem[];
  schedules?: ScheduleItem[];
}) {
  const state = {
    inbox: [...(seed?.inbox ?? [])] as InboxItem[],
    schedules: [...(seed?.schedules ?? [])] as ScheduleItem[],
  };

  const ops: CanonicalMutationOps = {
    getInboxById: (id) => state.inbox.find((i) => i.id === id),
    updateInbox: async (id, patch) => {
      state.inbox = state.inbox.map((i) =>
        i.id === id ? { ...i, ...patch } : i,
      );
      return true;
    },
    softDeleteInbox: async (id) => {
      state.inbox = state.inbox.map((i) =>
        i.id === id ? { ...i, status: "deleted" } : i,
      );
      return true;
    },
    getSchedules: () => state.schedules,
    updateSchedule: async (id, patch) => {
      state.schedules = state.schedules.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      );
      return true;
    },
    removeSchedule: async (id) => {
      state.schedules = state.schedules.filter((s) => s.id !== id);
      return true;
    },
    addSchedule: async (payload) => {
      const item = {
        id: payload.id ?? `sched-${state.schedules.length + 1}`,
        created_at: payload.created_at ?? new Date().toISOString(),
        alarm: payload.alarm ?? false,
        status: payload.status ?? "active",
        ...payload,
      } as ScheduleItem;
      state.schedules.push(item);
      return { item, cloudSynced: true };
    },
  };

  return { state, ops };
}

const timed: InboxItem = {
  id: "rec-1",
  text: "Dentist",
  images: [],
  created_at: "2026-08-20T01:00:00.000Z",
  status: "active",
  start_time: "2026-08-21T06:00:00.000Z",
  end_time: "2026-08-21T07:00:00.000Z",
  all_day: false,
  temporal_state: "exact_datetime",
  structured_at: "2026-08-20T01:05:00.000Z",
  content_revision: 1,
};

const sameIdProj: ScheduleItem = {
  id: "rec-1",
  text: "Dentist",
  start_time: "2026-08-21T06:00:00.000Z",
  end_time: "2026-08-21T07:00:00.000Z",
  alarm: false,
  created_at: "2026-08-20T01:05:00.000Z",
  source_id: "rec-1",
  status: "active",
};

const legacyProj: ScheduleItem = {
  id: "sched-rand",
  text: "Dentist",
  start_time: "2026-08-21T06:00:00.000Z",
  end_time: "2026-08-21T07:00:00.000Z",
  alarm: false,
  created_at: "2026-08-20T01:05:00.000Z",
  source_id: "rec-1",
  status: "active",
};

describe("canonical mutations", () => {
  it("syncRecordText bumps revision and projection text", async () => {
    const { state, ops } = makeOps({
      inbox: [timed],
      schedules: [sameIdProj],
    });
    await syncRecordText("rec-1", "Dentist visit", ops);
    expect(state.inbox[0]?.text).toBe("Dentist visit");
    expect(state.inbox[0]?.content_revision).toBe(2);
    expect(state.schedules[0]?.text).toBe("Dentist visit");
  });

  it("syncRecordTemporal clear keeps record and drops projection", async () => {
    const { state, ops } = makeOps({
      inbox: [timed],
      schedules: [legacyProj],
    });
    await syncRecordTemporal("rec-1", null, ops);
    expect(state.inbox[0]?.status).toBe("active");
    expect(state.inbox[0]?.start_time).toBeNull();
    expect(state.inbox[0]?.temporal_state).toBe("no_time");
    expect(state.schedules).toHaveLength(0);
  });

  it("complete / undoComplete sync both sides", async () => {
    const { state, ops } = makeOps({
      inbox: [timed],
      schedules: [sameIdProj],
    });
    await completeRecord("rec-1", ops);
    expect(state.inbox[0]?.status).toBe("done");
    expect(state.schedules[0]?.status).toBe("done");
    await undoCompleteRecord("rec-1", ops);
    expect(state.inbox[0]?.status).toBe("active");
    expect(state.schedules[0]?.status).toBe("active");
  });

  it("delete + undo restores exact temporal + legacy projection", async () => {
    const { state, ops } = makeOps({
      inbox: [{ ...timed, status: "done" }],
      schedules: [{ ...legacyProj, status: "done" }],
    });
    const snapshot = await deleteRecord("rec-1", ops);
    expect(snapshot).not.toBeNull();
    expect(state.inbox[0]?.status).toBe("deleted");
    expect(state.schedules).toHaveLength(0);

    await undoDeleteRecord(snapshot!, ops);
    expect(state.inbox[0]?.status).toBe("done");
    expect(state.inbox[0]?.start_time).toBe(timed.start_time);
    expect(state.inbox[0]?.temporal_state).toBe("exact_datetime");
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0]?.id).toBe("sched-rand");
    expect(state.schedules[0]?.source_id).toBe("rec-1");
    expect(state.schedules[0]?.status).toBe("done");
    expect(state.schedules[0]?.text).toBe("Dentist");
  });

  it("delete + undo restores same-id projection", async () => {
    const { state, ops } = makeOps({
      inbox: [timed],
      schedules: [sameIdProj],
    });
    const snapshot = await deleteRecord("rec-1", ops);
    await undoDeleteRecord(snapshot!, ops);
    expect(state.schedules[0]?.id).toBe("rec-1");
    expect(state.schedules[0]?.source_id).toBe("rec-1");
  });

  it("undo rebuilds projection when snapshot missed it but record was timed", async () => {
    const { state, ops } = makeOps({
      inbox: [{ ...timed, status: "deleted" }],
      schedules: [],
    });
    await undoDeleteRecord(
      { record: { ...timed, status: "active" }, projection: null },
      ops,
    );
    expect(state.inbox[0]?.status).toBe("active");
    expect(state.inbox[0]?.start_time).toBe(timed.start_time);
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0]?.id).toBe("rec-1");
    expect(state.schedules[0]?.source_id).toBe("rec-1");
    expect(state.schedules[0]?.start_time).toBe(timed.start_time);
  });
});
