import { describe, expect, it } from "vitest";
import {
  buildReminderPushPayload,
  reminderClickUrl,
  reminderIdempotencyKey,
} from "@/lib/push/reminderPayload";
import {
  buildReminderUpsert,
} from "@/lib/push/scheduledRemindersSync";
import { resolveUserTimezone, toUtcIso, isValidTimeRange } from "@/lib/push/timezone";
import type { ScheduleItem } from "@/lib/store";

function makeSchedule(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "sched-abc-123",
    text: "치과",
    start_time: "2026-07-26T06:00:00.000Z",
    end_time: "2026-07-26T07:00:00.000Z",
    alarm: true,
    alarm_at: "2026-07-26T05:00:00.000Z",
    created_at: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("reminderIdempotencyKey", () => {
  it("combines schedule id and due_at_utc", () => {
    expect(
      reminderIdempotencyKey("sched-1", "2026-07-26T05:00:00.000Z"),
    ).toBe("sched-1:2026-07-26T05:00:00.000Z");
  });

  it("changes when due time changes (edit supersedes)", () => {
    const a = reminderIdempotencyKey("sched-1", "2026-07-26T05:00:00.000Z");
    const b = reminderIdempotencyKey("sched-1", "2026-07-26T04:30:00.000Z");
    expect(a).not.toBe(b);
  });
});

describe("buildReminderUpsert", () => {
  it("returns null when alarm disabled", () => {
    expect(
      buildReminderUpsert("user-1", makeSchedule({ alarm: false })),
    ).toBeNull();
  });

  it("returns null when schedule is done", () => {
    expect(
      buildReminderUpsert(
        "user-1",
        makeSchedule({ status: "done" }),
      ),
    ).toBeNull();
  });

  it("returns null when due time is in the past", () => {
    expect(
      buildReminderUpsert(
        "user-1",
        makeSchedule({
          alarm_at: "2020-01-01T00:00:00.000Z",
        }),
      ),
    ).toBeNull();
  });

  it("builds pending row with timezone and idempotency key", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const row = buildReminderUpsert(
      "user-1",
      makeSchedule({ alarm_at: future }),
    );
    expect(row?.user_id).toBe("user-1");
    expect(row?.schedule_id).toBe("sched-abc-123");
    expect(row?.due_at_utc).toBe(future);
    expect(row?.status).toBe("pending");
    expect(row?.timezone).toBe(resolveUserTimezone());
    expect(row?.idempotency_key).toBe(
      reminderIdempotencyKey("sched-abc-123", future),
    );
  });
});

describe("privacy-safe push payload", () => {
  it("uses schedule title and time in push payload", () => {
    const schedule = makeSchedule();
    const payload = buildReminderPushPayload(schedule, "ko");
    const json = JSON.stringify(payload);
    expect(json).toContain("치과");
    expect(payload.title).toBe("치과");
    expect(payload.body).toMatch(/일정이에요\./);
    expect(payload.data.scheduleId).toBe("sched-abc-123");
  });

  it("notification click opens schedule detail URL", () => {
    expect(reminderClickUrl("sched-abc-123")).toBe(
      "/schedule?open=sched-abc-123",
    );
    expect(buildReminderPushPayload(makeSchedule()).data.url).toBe(
      "/schedule?open=sched-abc-123",
    );
  });
});

describe("timezone conversion", () => {
  it("stores UTC ISO from local Date", () => {
    const local = new Date("2026-07-26T14:00:00+09:00");
    expect(toUtcIso(local)).toBe("2026-07-26T05:00:00.000Z");
  });

  it("validates end is not before start", () => {
    const start = new Date("2026-07-26T15:00:00");
    const end = new Date("2026-07-26T14:00:00");
    expect(isValidTimeRange(start, end)).toBe(false);
    expect(isValidTimeRange(start, start)).toBe(true);
  });
});

describe("duplicate scheduler idempotency", () => {
  it("same idempotency key prevents double-send rows", () => {
    const due = "2026-07-26T05:00:00.000Z";
    const k1 = reminderIdempotencyKey("sched-1", due);
    const k2 = reminderIdempotencyKey("sched-1", due);
    expect(k1).toBe(k2);
  });
});
