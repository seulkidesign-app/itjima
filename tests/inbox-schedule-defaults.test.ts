import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasExplicitScheduleTime,
  inboxScheduleDefaults,
} from "@/lib/inboxScheduleDefaults";
import type { InboxItem } from "@/lib/store";

function thought(text: string): InboxItem {
  return {
    id: crypto.randomUUID(),
    text,
    images: [],
    created_at: new Date().toISOString(),
    status: "active",
  };
}

describe("inbox schedule defaults", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T13:20:00+09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a date without a stated time as all-day", () => {
    const result = inboxScheduleDefaults(thought("내일 치과"));
    expect(result.options).toMatchObject({
      allDay: true,
      startAllDay: true,
      endAllDay: true,
      reminderMinutes: null,
    });
    expect(result.start.getHours()).toBe(0);
    expect(result.end.getHours()).toBe(23);
    expect(result.end.getMinutes()).toBe(59);
  });

  it("keeps an explicitly timed thought as a timed schedule", () => {
    const result = inboxScheduleDefaults(thought("내일 오후 3시 치과"));
    expect(result.options).toMatchObject({
      allDay: false,
      startAllDay: false,
      endAllDay: false,
      reminderMinutes: null,
    });
    expect(result.start.getHours()).toBe(15);
  });

  it("maps bare 3시 to a 15:00 timed schedule", () => {
    const result = inboxScheduleDefaults(thought("내일 3시에 치과"));
    expect(result.options.allDay).toBe(false);
    expect(result.start.getHours()).toBe(15);
  });

  it("treats 퇴근 후 as an evening timed schedule", () => {
    const result = inboxScheduleDefaults(thought("오늘 퇴근 후 장보기"));
    expect(result.options.allDay).toBe(false);
    expect(result.start.getHours()).toBe(18);
  });

  it("recognizes common Korean and English time phrases", () => {
    expect(hasExplicitScheduleTime("내일 저녁 치과")).toBe(true);
    expect(hasExplicitScheduleTime("tomorrow at 3pm dentist")).toBe(true);
    expect(hasExplicitScheduleTime("내일 치과")).toBe(false);
  });

  it("uses a future working-hour default only when no date was supplied", () => {
    const result = inboxScheduleDefaults(thought("엄마한테 전화"));
    expect(result.options.allDay).toBe(false);
    expect(result.start.getTime()).toBeGreaterThan(Date.now());
  });
});
