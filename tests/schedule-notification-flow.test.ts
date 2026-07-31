import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildReminderPushPayload,
  reminderClickUrl,
} from "@/lib/push/reminderPayload";
import {
  buildReminderNotificationCopy,
  buildSaveSuccessCopy,
  formatReminderTimeInTimeZone,
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

describe("formatReminderTimeInTimeZone", () => {
  it("formats 20:00 KST as evening, not 11:00 UTC", () => {
    // 20:00 KST == 11:00 UTC — server getHours() bug showed 오전 11:00
    const label = formatReminderTimeInTimeZone(
      "2026-07-31T11:00:00.000Z",
      "Asia/Seoul",
      "ko",
    );
    expect(label).toMatch(/8:00/);
    expect(label).toMatch(/오후|PM/i);
    expect(label).not.toMatch(/11:00/);
  });
});

describe("process-reminders timezone formatting", () => {
  it("formats notification body with reminder timezone, not UTC getHours", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { resolve } = require("node:path") as typeof import("node:path");
    const cron = readFileSync(
      resolve(process.cwd(), "supabase/functions/process-reminders/index.ts"),
      "utf8",
    );
    expect(cron).toContain("formatTimeInZone");
    expect(cron).toContain("reminder.timezone");
    expect(cron).toContain("Asia/Seoul");
    expect(cron).not.toContain("date.getHours()");
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

  it("offers onboarding on iOS Safari install path even if permission looks granted", () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    expect(
      shouldOfferNotificationOnboarding(true, true, true, {
        needsIosInstall: true,
      }),
    ).toBe(true);
  });

  it("skips onboarding after seen flag is set", () => {
    markNotificationOnboardingSeen();
    expect(hasSeenNotificationOnboarding()).toBe(true);
    expect(shouldOfferNotificationOnboarding(true, true, true)).toBe(false);
  });
});

describe("first-notification onboarding sheet", () => {
  it("guides Home Screen install before permission on iOS Safari", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { resolve } = require("node:path") as typeof import("node:path");
    const sheet = readFileSync(
      resolve(
        process.cwd(),
        "src/components/ScheduleNotificationOnboardingSheet.tsx",
      ),
      "utf8",
    );
    const save = readFileSync(
      resolve(process.cwd(), "src/lib/push/scheduleNotificationSave.ts"),
      "utf8",
    );
    const route = readFileSync(
      resolve(process.cwd(), "src/routes/schedule.tsx"),
      "utf8",
    );
    expect(sheet).toContain("needsInstall");
    expect(sheet).toContain("홈 화면에 추가");
    expect(save).toContain("buildInstallGuideSaveCopy");
    expect(save).toContain("if (armed)");
    expect(save).toContain("markNotificationOnboardingSeen()");
    expect(route).toContain("needsIosInstall");
    expect(route).toContain("executeDirectPushEnableFlow");
    expect(route).toContain("showInstallGuide");
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

describe("schedule save must not fire due-time notification early", () => {
  it("does not call showNotification when saving an alarm", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { resolve } = require("node:path") as typeof import("node:path");
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/push/scheduleNotificationSave.ts"),
      "utf8",
    );
    expect(source).not.toContain("showNotification");
    expect(source).not.toContain("showScheduleTestNotification");
    expect(source).not.toContain("showLocalTestNotification");
    expect(source).toContain("syncScheduleReminderDetailed");
    expect(source).toContain("Never fire the real reminder copy at save time");
  });
});
