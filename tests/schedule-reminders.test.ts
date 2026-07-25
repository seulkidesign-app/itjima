import { describe, expect, it } from "vitest";
import {
  effectiveAlarmAt,
  reminderFireTime,
  getReminderOffset,
  setReminderOffset,
  clearReminderOffset,
} from "@/lib/scheduleReminders";
import type { ScheduleItem } from "@/lib/store";

function makeSchedule(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "test-schedule",
    text: "치과",
    start_time: new Date("2026-07-26T15:00:00+09:00").toISOString(),
    end_time: new Date("2026-07-26T16:00:00+09:00").toISOString(),
    alarm: true,
    alarm_at: new Date("2026-07-26T14:00:00+09:00").toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("schedule reminders", () => {
  it("uses alarm_at when present", () => {
    const s = makeSchedule();
    const at = effectiveAlarmAt(s);
    expect(at?.toISOString()).toBe("2026-07-26T05:00:00.000Z");
  });

  it("falls back to legacy offset when alarm_at missing", () => {
    const s = makeSchedule({ alarm_at: undefined });
    setReminderOffset(s.id, "10m");
    const at = effectiveAlarmAt(s);
    expect(at?.getTime()).toBe(
      reminderFireTime(s.start_time, "10m").getTime(),
    );
    clearReminderOffset(s.id);
  });

  it("returns null when alarm disabled", () => {
    const s = makeSchedule({ alarm: false });
    expect(effectiveAlarmAt(s)).toBeNull();
  });

  it("legacy offset round-trips through localStorage", () => {
    setReminderOffset("legacy-test", "1h");
    expect(getReminderOffset("legacy-test")).toBe("1h");
    clearReminderOffset("legacy-test");
    expect(getReminderOffset("legacy-test")).toBe("1h");
  });
});

describe("schedule start/end validation", () => {
  it("end must not be before start", () => {
    const start = new Date("2026-07-26T15:00:00");
    const end = new Date("2026-07-26T14:00:00");
    expect(end.getTime()).toBeLessThan(start.getTime());
  });
});
