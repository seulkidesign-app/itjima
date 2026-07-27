import { describe, expect, it } from "vitest";
import {
  effectiveAlarmAt,
  formatAlarmLabel,
  presetToAlarmAt,
} from "@/lib/scheduleReminders";
import type { ScheduleItem } from "@/lib/store";

function schedule(patch: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "schedule-1",
    text: "치과",
    start_time: "2026-07-28T15:00:00.000Z",
    end_time: "2026-07-28T16:00:00.000Z",
    alarm: true,
    created_at: "2026-07-27T01:00:00.000Z",
    status: "active",
    ...patch,
  };
}

describe("schedule reminder safety", () => {
  it("rejects an invalid stored alarm time", () => {
    expect(effectiveAlarmAt(schedule({ alarm_at: "not-a-date" }))).toBeNull();
  });

  it("never renders a positive reminder as zero minutes away", () => {
    const now = new Date("2026-07-27T10:00:00.000Z");
    const at = new Date(now.getTime() + 10_000);
    expect(formatAlarmLabel(at, "ko", now)).toBe("1분 후");
  });

  it("moves the evening preset to the next day after 6pm", () => {
    const now = new Date("2026-07-27T19:00:00+09:00");
    const at = presetToAlarmAt("tonight", now);
    expect(at.getDate()).toBe(28);
    expect(at.getHours()).toBe(18);
  });

  it("returns a safe label for an invalid date", () => {
    expect(formatAlarmLabel(new Date("invalid"), "ko")).toBe("알림 시간 확인 필요");
  });
});
