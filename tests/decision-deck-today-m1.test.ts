import { beforeEach, describe, expect, it } from "vitest";
import {
  captureDecisionStorage,
  recoverLocallyCommittedDecision,
} from "@/lib/decisionRecovery";
import {
  convertLaterInboxToSchedule,
  resetLaterInboxConvertLocksForTests,
  type ConvertLaterInboxOps,
  type LaterInboxScheduleFields,
} from "@/lib/convertLaterInboxToSchedule";
import type { InboxItem, ScheduleItem } from "@/lib/store";

/**
 * DecisionDeck "today" remains reachable via Context menu → Sort one by one
 * and DecisionLauncher. It must keep the canonical inbox and only upsert a
 * schedule projection (no inbox delete).
 */
describe("DecisionDeck today path (M1 hardening)", () => {
  beforeEach(() => {
    resetLaterInboxConvertLocksForTests();
    localStorage.clear();
  });

  it("keeps canonical inbox when structuring via today commit helper", async () => {
    const item: InboxItem = {
      id: "deck-1",
      text: "내일 오후 2시 미팅",
      images: [],
      created_at: "2026-08-20T01:00:00.000Z",
      status: "active",
      content_revision: 0,
    };
    const state = {
      schedules: [] as ScheduleItem[],
      inbox: [{ ...item }] as InboxItem[],
    };
    const fields: LaterInboxScheduleFields = {
      text: "미팅",
      start_time: "2026-08-21T05:00:00.000Z",
      end_time: "2026-08-21T06:00:00.000Z",
      alarm: false,
      all_day: false,
    };
    const ops: ConvertLaterInboxOps = {
      addSchedule: async (payload) => {
        const created = {
          id: payload.id ?? item.id,
          created_at: item.created_at,
          ...payload,
        } as ScheduleItem;
        state.schedules.push(created);
        localStorage.setItem(
          "itjima.guest.schedules",
          JSON.stringify(state.schedules),
        );
        return { item: created, cloudSynced: true };
      },
      updateSchedule: async () => true,
      removeSchedule: async (id) => {
        state.schedules = state.schedules.filter((s) => s.id !== id);
        return true;
      },
      getScheduleByRecordId: (id) =>
        state.schedules.find((s) => s.id === id || s.source_id === id),
      getInboxById: (id) => state.inbox.find((i) => i.id === id),
      updateInbox: async (id, patch) => {
        state.inbox = state.inbox.map((i) =>
          i.id === id ? { ...i, ...patch } : i,
        );
        localStorage.setItem(
          "itjima.guest.inbox",
          JSON.stringify(state.inbox),
        );
        return true;
      },
    };

    localStorage.setItem("itjima.guest.inbox", JSON.stringify(state.inbox));
    localStorage.setItem("itjima.guest.schedules", JSON.stringify([]));
    const before = captureDecisionStorage(item.id);

    const result = await convertLaterInboxToSchedule(item, fields, ops);
    expect(result.status).toBe("ok");
    expect(state.inbox).toHaveLength(1);
    expect(state.inbox[0].id).toBe(item.id);
    expect(state.inbox[0].temporal_state).toBe("exact_datetime");
    expect(state.schedules).toHaveLength(1);

    // Recovery must succeed while inbox is still present (M1 contract).
    expect(
      recoverLocallyCommittedDecision("today", item.id, before),
    ).toEqual({ scheduleId: item.id });
  });

  it("does not treat inbox presence as failure for today recovery", () => {
    const itemId = "deck-keep";
    localStorage.setItem(
      "itjima.guest.inbox",
      JSON.stringify([
        {
          id: itemId,
          text: "keep me",
          created_at: "2026-08-20T01:00:00.000Z",
          status: "active",
          temporal_state: "exact_datetime",
        },
      ]),
    );
    localStorage.setItem(
      "itjima.guest.schedules",
      JSON.stringify([
        {
          id: itemId,
          text: "keep me",
          source_id: itemId,
          created_at: "2026-08-20T01:01:00.000Z",
        },
      ]),
    );
    const before = {
      scheduleIds: new Set<string>(),
      archiveIds: new Set<string>(),
      inboxPresent: true,
    };
    expect(recoverLocallyCommittedDecision("today", itemId, before)).toEqual({
      scheduleId: itemId,
    });
  });
});
