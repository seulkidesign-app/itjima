import { describe, expect, it } from "vitest";
import { deleteRecord, undoDeleteRecord, type CanonicalMutationOps } from "@/lib/canonicalMutations";
import { withNlConfirmGuard } from "@/lib/nlConfirmGuard";
import type { InboxItem, ScheduleItem } from "@/lib/store";

function temporalRecord(
  temporalState: "exact_datetime" | "date_only" | "fuzzy_time",
): InboxItem {
  return {
    id: `rec-${temporalState}`,
    text:
      temporalState === "date_only"
        ? "내일 운동"
        : temporalState === "fuzzy_time"
          ? "내일 오후 운동"
          : "내일 오후 3시 운동",
    images: [],
    created_at: "2026-09-01T00:00:00.000Z",
    status: "active",
    start_time: "2026-09-02T00:00:00.000Z",
    end_time: "2026-09-03T00:00:00.000Z",
    all_day: temporalState !== "exact_datetime",
    temporal_state: temporalState,
    structured_at: "2026-09-01T00:00:01.000Z",
    clarification_state: "resolved",
    content_revision: 1,
  };
}

function projectionFor(record: InboxItem): ScheduleItem {
  return {
    id: record.id,
    source_id: record.id,
    text: record.text,
    start_time: record.start_time!,
    end_time: record.end_time!,
    alarm: false,
    all_day: Boolean(record.all_day),
    start_all_day: Boolean(record.all_day),
    end_all_day: Boolean(record.all_day),
    created_at: record.structured_at ?? record.created_at,
    status: "active",
    raw_text: record.text,
  };
}

function makeOps(seed: {
  inbox: InboxItem[];
  schedules: ScheduleItem[];
  failSoftDelete?: boolean;
}) {
  const state = {
    inbox: seed.inbox.map((row) => ({ ...row })),
    schedules: seed.schedules.map((row) => ({ ...row })),
  };

  const ops: CanonicalMutationOps = {
    getInboxById: (id) => state.inbox.find((row) => row.id === id),
    updateInbox: async (id, patch) => {
      state.inbox = state.inbox.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      );
      return true;
    },
    softDeleteInbox: async (id) => {
      if (seed.failSoftDelete) return false;
      state.inbox = state.inbox.map((row) =>
        row.id === id ? { ...row, status: "deleted" } : row,
      );
      return true;
    },
    getSchedules: () => state.schedules,
    updateSchedule: async (id, patch) => {
      state.schedules = state.schedules.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      );
      return true;
    },
    removeSchedule: async (id) => {
      state.schedules = state.schedules.filter((row) => row.id !== id);
      return true;
    },
    addSchedule: async (payload) => {
      const item = {
        id: payload.id ?? `sched-${state.schedules.length + 1}`,
        text: payload.text,
        start_time: payload.start_time,
        end_time: payload.end_time,
        alarm: payload.alarm ?? false,
        created_at: payload.created_at ?? "2026-09-01T00:00:00.000Z",
        status: payload.status ?? "active",
        ...payload,
      } as ScheduleItem;
      state.schedules.push(item);
      return { item, cloudSynced: true };
    },
  };

  return { state, ops };
}

describe("pre-Rediscovery state red team", () => {
  it("does not lose a schedule projection when canonical delete fails", async () => {
    const record = temporalRecord("date_only");
    const projection = projectionFor(record);
    const { state, ops } = makeOps({
      inbox: [record],
      schedules: [projection],
      failSoftDelete: true,
    });

    const snapshot = await deleteRecord(record.id, ops);

    expect(snapshot).toBeNull();
    expect(state.inbox[0]?.status).toBe("active");
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0]?.source_id).toBe(record.id);
    expect(state.schedules[0]?.start_time).toBe(record.start_time);
  });

  for (const temporalState of ["date_only", "fuzzy_time"] as const) {
    it(`undo rebuilds a missing ${temporalState} projection instead of leaving a structured orphan`, async () => {
      const record = temporalRecord(temporalState);
      const { state, ops } = makeOps({
        inbox: [{ ...record, status: "deleted" }],
        schedules: [],
      });

      const restored = await undoDeleteRecord(
        { record: { ...record }, projection: null },
        ops,
      );

      expect(restored).toBe(true);
      expect(state.inbox[0]?.status).toBe("active");
      expect(state.inbox[0]?.temporal_state).toBe(temporalState);
      expect(state.schedules).toHaveLength(1);
      expect(state.schedules[0]?.source_id).toBe(record.id);
      expect(state.schedules[0]?.all_day).toBe(true);
      expect(state.schedules[0]?.start_time).toBe(record.start_time);
    });
  }

  it("double-tap guard permits only one concurrent commit for the same record", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let commits = 0;

    const first = withNlConfirmGuard("redteam-double-tap", async () => {
      commits += 1;
      await gate;
    });
    const second = withNlConfirmGuard("redteam-double-tap", async () => {
      commits += 1;
    });

    expect(await second).toBe(false);
    expect(commits).toBe(1);
    release();
    expect(await first).toBe(true);
    expect(commits).toBe(1);
  });
});
