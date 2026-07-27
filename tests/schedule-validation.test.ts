import { describe, expect, it } from "vitest";
import {
  isAccidentalNextYearRollover,
  scheduleValidationMessage,
  validateScheduleRange,
} from "@/lib/scheduleValidation";

describe("schedule save validation", () => {
  const now = new Date(2026, 6, 27, 18, 30, 0);

  it("blocks the same month and day silently moved to next year", () => {
    const start = new Date(2027, 6, 27, 9, 0, 0);
    const end = new Date(2027, 6, 27, 10, 0, 0);

    expect(isAccidentalNextYearRollover(start, now)).toBe(true);
    expect(validateScheduleRange(start, end, { now })).toEqual({
      ok: false,
      reason: "past_time_rollover",
    });
  });

  it("allows an intentional different day next year", () => {
    const start = new Date(2027, 6, 28, 9, 0, 0);
    const end = new Date(2027, 6, 28, 10, 0, 0);
    expect(validateScheduleRange(start, end, { now })).toEqual({ ok: true });
  });

  it("allows editing an existing next-year schedule", () => {
    const start = new Date(2027, 6, 27, 9, 0, 0);
    const end = new Date(2027, 6, 27, 10, 0, 0);
    expect(validateScheduleRange(start, end, { now, editMode: true })).toEqual({
      ok: true,
    });
  });

  it("rejects invalid or reversed ranges", () => {
    const start = new Date(2026, 6, 28, 10, 0, 0);
    const end = new Date(2026, 6, 28, 9, 0, 0);
    expect(validateScheduleRange(start, end, { now })).toEqual({
      ok: false,
      reason: "invalid_range",
    });
  });

  it("uses an actionable Korean message", () => {
    expect(scheduleValidationMessage("past_time_rollover", "ko")).toContain(
      "다른 시간을 골라주세요",
    );
  });
});
