import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildNaturalScheduleDraft,
  hasNaturalRepeatIntent,
  inferNaturalReminderMinutes,
  resolveNaturalScheduleStart,
} from "@/lib/naturalScheduleDraft";
import { buildReminderUpsert } from "@/lib/push/scheduledRemindersSync";
import type { InboxItem, ScheduleItem } from "@/lib/store";

function thought(text: string): InboxItem {
  return {
    id: "thought-1",
    text,
    images: [],
    created_at: new Date().toISOString(),
    status: "active",
  };
}

describe("natural schedule commitment parsing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Friday night. "next Friday" must never collapse to today.
    vi.setSystemTime(new Date("2026-08-07T23:07:00+09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns a realistic Korean sentence into the exact commitment", () => {
    const draft = buildNaturalScheduleDraft(
      thought("다음 주 금요일 퇴근하고 치과. 전날에도 알려줘"),
    );

    expect(draft.start.getFullYear()).toBe(2026);
    expect(draft.start.getMonth()).toBe(7);
    expect(draft.start.getDate()).toBe(14);
    expect(draft.start.getDay()).toBe(5);
    expect(draft.start.getHours()).toBe(18);
    expect(draft.options.allDay).toBe(false);
    expect(draft.options.reminderMinutes).toBe(24 * 60);
    expect(draft.options.repeat).toBeNull();
    expect(draft.reminderExplicit).toBe(true);
    expect(draft.text).toBe("치과");
  });

  it("turns the parsed reminder into the exact backend queue due time", () => {
    const draft = buildNaturalScheduleDraft(
      thought("다음 주 금요일 퇴근하고 치과. 전날에도 알려줘"),
    );
    const alarmAt = new Date(
      draft.start.getTime() - draft.options.reminderMinutes! * 60_000,
    );
    const schedule: ScheduleItem = {
      id: "schedule-1",
      text: draft.text,
      start_time: draft.start.toISOString(),
      end_time: draft.end.toISOString(),
      alarm: true,
      alarm_at: alarmAt.toISOString(),
      all_day: draft.options.allDay,
      start_all_day: draft.options.startAllDay,
      end_all_day: draft.options.endAllDay,
      repeat: null,
      created_at: new Date().toISOString(),
      status: "active",
    };

    const queued = buildReminderUpsert("user-1", schedule);
    expect(queued).not.toBeNull();
    expect(queued!.schedule_id).toBe("schedule-1");
    expect(queued!.due_at_utc).toBe(alarmAt.toISOString());
    expect(new Date(queued!.due_at_utc).getTime()).toBe(
      draft.start.getTime() - 24 * 60 * 60 * 1000,
    );
  });

  it("keeps next-week weekday semantics instead of choosing the nearest weekday", () => {
    const start = resolveNaturalScheduleStart("다음 주 금요일 오후 3시 미팅");
    expect(start).not.toBeNull();
    expect(start!.getDate()).toBe(14);
    expect(start!.getHours()).toBe(15);
  });

  it("defaults precise timed commitments to an at-start reminder", () => {
    const draft = buildNaturalScheduleDraft(thought("내일 오후 3시 치과"));
    expect(draft.options.reminderMinutes).toBe(0);
    expect(draft.reminderExplicit).toBe(false);
  });

  it("does not invent an alarm for an all-day date-only plan", () => {
    const draft = buildNaturalScheduleDraft(thought("내일 치과"));
    expect(draft.options.allDay).toBe(true);
    expect(draft.options.reminderMinutes).toBeNull();
  });

  it("recognizes reminder offsets without pretending recurrence is a one-off", () => {
    expect(inferNaturalReminderMinutes("1시간 전 알려줘", true)).toEqual({
      minutes: 60,
      explicit: true,
    });
    expect(hasNaturalRepeatIntent("매주 월요일 오전 9시 팀 회의")).toBe(true);
    expect(hasNaturalRepeatIntent("every month review bills")).toBe(true);
    expect(hasNaturalRepeatIntent("내일 오후 3시 치과")).toBe(false);
  });
});
