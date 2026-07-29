import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildReminderPushPayload,
  reminderClickUrl,
} from "@/lib/push/reminderPayload";
import {
  buildReminderNotificationCopy,
  buildSaveSuccessCopy,
} from "@/lib/push/scheduleNotificationContent";
import {
  defaultReminderForNewSchedule,
  inferReminderKeyFromSchedule,
  scheduleHasSpecificTime,
} from "@/lib/push/scheduleNotificationDefaults";
import {
  hasSeenNotificationOnboarding,
  markNotificationOnboardingSeen,
  shouldOfferNotificationOnboarding,
} from "@/lib/push/scheduleNotificationSave";
import type { ScheduleItem } from "@/lib/store";

function makeSchedule(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "sched-abc-123",
    text: "치과",
    start_time: "2026-07-26T11:30:00.000+09:00",
    end_time: "2026-07-26T12:30:00.000+09:00",
    alarm: true,
    alarm_at: "2026-07-26T11:30:00.000+09:00",
    created_at: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildReminderPushPayload", () => {
  it("uses schedule title and start time in notification copy", () => {
    const schedule = makeSchedule();
    const payload = buildReminderPushPayload(schedule, "ko");
    expect(payload.title).toBe("치과");
    expect(payload.body).toMatch(/일정이에요\./);
    expect(payload.data.url).toBe(reminderClickUrl(schedule.id));
    expect(payload.data.scheduleId).toBe(schedule.id);
  });

  it("falls back to 잊지마 when title is empty", () => {
    const payload = buildReminderPushPayload(
      makeSchedule({ text: "   " }),
      "ko",
    );
    expect(payload.title).toBe("잊지마");
  });
});

describe("buildReminderNotificationCopy", () => {
  it("formats body from schedule start time", () => {
    const copy = buildReminderNotificationCopy(
      makeSchedule({ start_time: "2026-07-26T11:30:00.000+09:00" }),
      "ko",
    );
    expect(copy.body).toContain("일정이에요.");
  });
});

describe("schedule notification defaults", () => {
  it("defaults timed schedules to at-time reminder", () => {
    expect(defaultReminderForNewSchedule(true)).toBe("at");
  });

  it("defaults all-day schedules to off", () => {
    expect(defaultReminderForNewSchedule(false)).toBe("off");
  });

  it("detects specific time from all-day flags", () => {
    expect(scheduleHasSpecificTime(false, false)).toBe(true);
    expect(scheduleHasSpecificTime(true, true)).toBe(false);
  });

  it("infers reminder key from stored alarm offset", () => {
    const schedule = makeSchedule({
      start_time: "2026-07-26T12:00:00.000Z",
      alarm_at: "2026-07-26T11:30:00.000Z",
    });
    expect(inferReminderKeyFromSchedule(schedule)).toBe("30m");
  });
});

describe("notification onboarding gate", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("Notification", {
      permission: "default",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers onboarding only for new timed schedules with default permission", () => {
    expect(shouldOfferNotificationOnboarding(true, true, true)).toBe(true);
    expect(shouldOfferNotificationOnboarding(true, true, false)).toBe(false);
    expect(shouldOfferNotificationOnboarding(true, false, true)).toBe(false);
    expect(shouldOfferNotificationOnboarding(false, true, true)).toBe(false);
  });

  it("skips onboarding after seen flag is set", () => {
    markNotificationOnboardingSeen();
    expect(hasSeenNotificationOnboarding()).toBe(true);
    expect(shouldOfferNotificationOnboarding(true, true, true)).toBe(false);
  });
});

describe("buildSaveSuccessCopy", () => {
  it("shows ready copy when notifications are prepared", () => {
    const future = new Date(Date.now() + 3_600_000);
    const start = new Date(future.getTime() + 5 * 60_000);
    const copy = buildSaveSuccessCopy(
      {
        id: "s1",
        text: "회의",
        start_time: start.toISOString(),
        alarm: true,
        alarm_at: future.toISOString(),
      },
      "ko",
      { notificationReady: true },
    );
    expect(copy.headline).toBe("알림 준비 완료");
    expect(copy.detail).toMatch(/알려드릴게요\./);
  });
});
