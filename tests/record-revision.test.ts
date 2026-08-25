import { describe, expect, it } from "vitest";
import {
  contentRevisionOf,
  isStaleContentRevision,
  nextContentRevision,
  withBumpedContentRevision,
} from "@/lib/recordRevision";
import { setInboxBrainMirror, type InboxItem } from "@/lib/store";
import {
  convertLaterInboxToSchedule,
  resetLaterInboxConvertLocksForTests,
  type ConvertLaterInboxOps,
  type LaterInboxScheduleFields,
} from "@/lib/convertLaterInboxToSchedule";
import type { ScheduleItem } from "@/lib/store";
import { beforeEach } from "vitest";

describe("recordRevision stale guard", () => {
  it("detects stale responses after a user bump", () => {
    expect(contentRevisionOf({ content_revision: 0 })).toBe(0);
    expect(nextContentRevision(0)).toBe(1);
    expect(isStaleContentRevision(0, { content_revision: 0 })).toBe(false);
    expect(isStaleContentRevision(0, { content_revision: 1 })).toBe(true);
    expect(isStaleContentRevision(0, undefined)).toBe(true);
  });

  it("bumps revision on user edit patches", () => {
    expect(
      withBumpedContentRevision({ content_revision: 2 }, { text: "edited" }),
    ).toEqual({ text: "edited", content_revision: 3 });
  });

  it("rejects late AI mirror when revision moved", async () => {
    const item: InboxItem = {
      id: "r1",
      text: "original",
      images: [],
      created_at: "2026-08-25T00:00:00.000Z",
      content_revision: 0,
    };
    let live = { ...item };
    const inbox = {
      items: [live],
      update: async (id: string, patch: Partial<InboxItem>) => {
        live = { ...live, ...patch };
        inbox.items = [live];
        return true;
      },
    } as unknown as ReturnType<typeof import("@/lib/store").useInbox>;

    // User edits while AI is in flight.
    live = {
      ...live,
      ...withBumpedContentRevision(live, { text: "user edited" }),
    };
    inbox.items = [live];

    const result = await setInboxBrainMirror(
      inbox,
      "r1",
      {
        title: "AI title",
        items: ["AI bullet"],
        suggestedDateText: "",
        suggestedAction: "",
        confidence: 0.9,
      },
      { expectedRevision: 0 },
    );

    expect(result).toEqual({ applied: false, reason: "stale" });
    expect(live.text).toBe("user edited");
    expect(live.brain_mirror).toBeUndefined();
  });

  it("applies AI mirror when revision still matches", async () => {
    const item: InboxItem = {
      id: "r2",
      text: "stable",
      images: [],
      created_at: "2026-08-25T00:00:00.000Z",
      content_revision: 1,
    };
    let live = { ...item };
    const inbox = {
      items: [live],
      update: async (_id: string, patch: Partial<InboxItem>) => {
        live = { ...live, ...patch };
        inbox.items = [live];
        return true;
      },
    } as unknown as ReturnType<typeof import("@/lib/store").useInbox>;

    const result = await setInboxBrainMirror(
      inbox,
      "r2",
      {
        title: "AI title",
        items: ["AI bullet"],
        suggestedDateText: "",
        suggestedAction: "",
        confidence: 0.9,
      },
      { expectedRevision: 1 },
    );

    expect(result.applied).toBe(true);
    expect(live.text).toBe("stable");
    expect(live.brain_mirror?.title).toBe("AI title");
  });
});

describe("stale timed attach after user edit", () => {
  beforeEach(() => {
    resetLaterInboxConvertLocksForTests();
    localStorage.clear();
  });

  it("rejects projection attach when user bumped revision mid-flight", async () => {
    const item: InboxItem = {
      id: "later-stale",
      text: "내일 오후 3시 치과",
      images: [],
      created_at: "2026-08-20T01:00:00.000Z",
      status: "active",
      content_revision: 0,
      temporal_state: "no_time",
    };
    const state = {
      schedules: [] as ScheduleItem[],
      inbox: [{ ...item }] as InboxItem[],
    };
    const fields: LaterInboxScheduleFields = {
      text: "치과",
      start_time: "2026-08-21T06:00:00.000Z",
      end_time: "2026-08-21T07:00:00.000Z",
      alarm: false,
      all_day: false,
    };

    const ops: ConvertLaterInboxOps = {
      addSchedule: async (payload) => {
        // Simulate user edit while schedule write is in flight.
        state.inbox[0] = {
          ...state.inbox[0],
          text: "user changed this",
          content_revision: 1,
        };
        const created = {
          id: payload.id ?? item.id,
          created_at: item.created_at,
          ...payload,
        } as ScheduleItem;
        state.schedules.push(created);
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
        return true;
      },
    };

    const result = await convertLaterInboxToSchedule(item, fields, ops, {
      expectedRevision: 0,
    });

    expect(result.status).toBe("stale_revision");
    expect(state.schedules).toHaveLength(0);
    expect(state.inbox[0].text).toBe("user changed this");
    expect(state.inbox[0].start_time).toBeUndefined();
  });
});
