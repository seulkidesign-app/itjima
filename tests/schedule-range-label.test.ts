import { describe, expect, it } from "vitest";
import { formatScheduleRangeLabel } from "@/lib/scheduleTime";

describe("formatScheduleRangeLabel", () => {
  const now = new Date(2026, 7, 23, 12, 0, 0); // Sun Aug 23 2026 local

  it("does not repeat tomorrow for a same-day timed range", () => {
    const start = new Date(2026, 7, 24, 15, 0, 0);
    const end = new Date(2026, 7, 24, 16, 0, 0);
    expect(
      formatScheduleRangeLabel(start, end, false, false, "ko", now),
    ).toBe("내일 · 15:00–16:00");
    expect(
      formatScheduleRangeLabel(start, end, false, false, "en", now),
    ).toBe("Tomorrow · 15:00–16:00");
  });

  it("shows a single clock when the range is short on tomorrow", () => {
    const start = new Date(2026, 7, 24, 15, 0, 0);
    const end = new Date(2026, 7, 24, 15, 20, 0);
    expect(
      formatScheduleRangeLabel(start, end, false, false, "ko", now),
    ).toBe("내일 · 15:00");
  });

  it("keeps today as time-only without repeating a day label", () => {
    const start = new Date(2026, 7, 23, 15, 0, 0);
    const end = new Date(2026, 7, 23, 17, 0, 0);
    expect(
      formatScheduleRangeLabel(start, end, false, false, "ko", now),
    ).toBe("15:00–17:00");
  });

  it("preserves multi-day ranges with distinct day labels", () => {
    const start = new Date(2026, 7, 24, 15, 0, 0);
    const end = new Date(2026, 7, 25, 10, 0, 0);
    const ko = formatScheduleRangeLabel(start, end, false, false, "ko", now);
    const en = formatScheduleRangeLabel(start, end, false, false, "en", now);
    expect(ko).toContain("→");
    expect(ko.startsWith("내일 ")).toBe(true);
    expect(ko).toMatch(/15:00/);
    expect(ko).toMatch(/10:00/);
    expect(en).toContain("→");
    expect(en.startsWith("Tomorrow ")).toBe(true);
  });

  it("formats same-day all-day without repeating the day token twice", () => {
    const start = new Date(2026, 7, 24, 0, 0, 0);
    const end = new Date(2026, 7, 24, 23, 59, 0);
    expect(
      formatScheduleRangeLabel(start, end, true, true, "ko", now),
    ).toBe("내일 · 종일");
  });
});
