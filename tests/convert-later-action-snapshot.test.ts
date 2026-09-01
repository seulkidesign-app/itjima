import { beforeEach, describe, expect, it } from "vitest";
import {
  convertLaterInboxToSchedule,
  resetLaterInboxConvertLocksForTests,
  type ConvertLaterInboxOps,
  type LaterInboxScheduleFields,
} from "@/lib/convertLaterInboxToSchedule";
import type { InboxItem, ScheduleItem } from "@/lib/store";

const original = "내일 오후 3시 운동하고 오후 5시 병원";
const corrected = "내일 오후 4시 운동";

function actionItem(revision = 0): InboxItem {
  return {
    id: "edited-1",
    text: corrected,
    raw_text: original,
    images: [],
    created_at: "2026-09-01T00:00:00.000Z",
    status: "active",
    temporal_state: "ambiguous",
    clarification_state: "pending",
    content_revision: revision,
  };
}

const fields: LaterInboxScheduleFields = {
  text: "운동",
  start_time: "2026-09-02T07:00:00.000Z",
  end_time: "2026-09-02T08:00:00.000Z",
  alarm: true,
  all_day: false,
  start_all_day: false,
  end_all_day: false,
  repeat: null,
};

function harness(observed: InboxItem) {
  const state = {
    inbox: { ...observed },
    schedules: [] as ScheduleItem[],
  };

  const ops: ConvertLaterInboxOps = {
    addSchedule: async (payload) => {
      const row = {
        id: payload.id ?? observed.id,
        created_at: observed.created_at,
        ...payload,
      } as ScheduleItem;
      state.schedules.push(row);
      return { item: row, cloudSynced: true };
    },
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
    getScheduleByRecordId: (id) =>
      state.schedules.find((row) => row.id === id || row.source_id === id),
    // Deliberately returns a render-lagged snapshot in the first test.
    getInboxById: () => state.inbox,
    updateInbox: async (_id, patch) => {
      state.inbox = { ...state.inbox, ...patch };
      return true;
    },
  };

  return { state, ops };
}

describe("schedule commit action snapshot precedence", () => {
  beforeEach(() => resetLaterInboxConvertLocksForTests());

  it("does not overwrite a just-edited action snapshot with an equal-revision render-lagged row", async () => {
    const staleRender: InboxItem = {
      ...actionItem(0),
      text: original,
    };
    const { state, ops } = harness(staleRender);

    const result = await convertLaterInboxToSchedule(
      actionItem(0),
      fields,
      ops,
      { expectedRevision: 0 },
    );

    expect(result).toEqual({ status: "ok", scheduleId: "edited-1" });
    expect(state.inbox.text).toBe(corrected);
    expect(state.inbox.temporal_state).toBe("exact_datetime");
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0]).toMatchObject({
      source_id: "edited-1",
      text: "운동",
      raw_text: original,
    });
  });

  it("still rejects a genuinely newer canonical revision", async () => {
    const newer: InboxItem = {
      ...actionItem(1),
      text: "사용자가 다시 고친 문장",
    };
    const { state, ops } = harness(newer);

    const result = await convertLaterInboxToSchedule(
      actionItem(0),
      fields,
      ops,
      { expectedRevision: 0 },
    );

    expect(result).toEqual({ status: "stale_revision" });
    expect(state.inbox.text).toBe("사용자가 다시 고친 문장");
    expect(state.schedules).toHaveLength(0);
  });
});
