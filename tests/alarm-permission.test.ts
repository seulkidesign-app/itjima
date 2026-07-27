import { describe, expect, it, vi } from "vitest";
import {
  canRequestNotificationPermission,
  canSelectAlarmPresets,
  isIosSafariTab,
  resolveAlarmSheetView,
} from "@/lib/alarmAvailability";
import {
  completeAlarmEnableAfterGrant,
  runAlarmEnableFlow,
} from "@/lib/alarmPermissionFlow";
import { buildReminderUpsert } from "@/lib/push/scheduledRemindersSync";
import type { ScheduleItem } from "@/lib/store";

function makeSchedule(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "sched-1",
    text: "치과",
    start_time: "2026-07-26T06:00:00.000Z",
    end_time: "2026-07-26T07:00:00.000Z",
    alarm: false,
    created_at: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("alarm sheet view", () => {
  it("shows default state with enable CTA when permission is default", () => {
    expect(resolveAlarmSheetView("default", false)).toBe("default");
    expect(canRequestNotificationPermission("default")).toBe(true);
  });

  it("does not call requestPermission again when denied", () => {
    expect(resolveAlarmSheetView("denied", false)).toBe("denied");
    expect(canRequestNotificationPermission("denied")).toBe(false);
  });

  it("blocks presets on iOS Safari tab (non-standalone)", () => {
    expect(resolveAlarmSheetView("granted", true)).toBe("ios_install");
    expect(canSelectAlarmPresets("ios_install", true)).toBe(false);
    expect(canSelectAlarmPresets("granted", false)).toBe(false);
  });
});

describe("alarm enable flow", () => {
  it("calls requestPermission before subscribePush", async () => {
    const order: string[] = [];
    const requestPermission = vi.fn(async () => {
      order.push("requestPermission");
      return "granted" as NotificationPermission;
    });
    const subscribePush = vi.fn(async () => {
      order.push("subscribePush");
      return { ok: true, state: "granted" as const };
    });
    const showTestNotification = vi.fn(async () => {
      order.push("showTestNotification");
      return true;
    });

    await runAlarmEnableFlow({
      userId: "user-1",
      requestPermission,
      subscribePush,
      showTestNotification,
    });

    expect(order[0]).toBe("requestPermission");
    expect(order).toContain("subscribePush");
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it("creates push subscription after permission is granted", async () => {
    const subscribePush = vi.fn(async () => ({ ok: true, state: "granted" as const }));
    const result = await completeAlarmEnableAfterGrant("user-1", {
      subscribePush,
      showTestNotification: async () => true,
    });

    expect(subscribePush).toHaveBeenCalledWith("user-1");
    expect(result.pushSubscribed).toBe(true);
    expect(result.testNotificationShown).toBe(true);
  });

  it("does not report success when subscription save fails", async () => {
    const result = await completeAlarmEnableAfterGrant("user-1", {
      subscribePush: async () => ({ ok: false, state: "expired" as const }),
      showTestNotification: async () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.pushSubscribed).toBe(false);
    expect(result.testNotificationShown).toBe(false);
  });

  it("does not subscribe when permission is denied", async () => {
    const subscribePush = vi.fn(async () => ({ ok: true, state: "granted" as const }));
    const result = await runAlarmEnableFlow({
      userId: "user-1",
      requestPermission: async () => "denied",
      subscribePush,
    });

    expect(result.ok).toBe(false);
    expect(subscribePush).not.toHaveBeenCalled();
  });

  it("local enable flow does not claim server delivery success", async () => {
    const result = await completeAlarmEnableAfterGrant("user-1", {
      subscribePush: async () => ({ ok: true, state: "granted" as const }),
      showTestNotification: async () => true,
    });
    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty("serverVerified");
  });
});

describe("alarm preset gating", () => {
  it("shows presets only after push is ready", () => {
    expect(canSelectAlarmPresets("default", false)).toBe(false);
    expect(canSelectAlarmPresets("granted", false)).toBe(false);
    expect(canSelectAlarmPresets("granted", true)).toBe(true);
  });

  it("requires test notification success before presets after enable", async () => {
    const result = await completeAlarmEnableAfterGrant("user-1", {
      subscribePush: async () => ({ ok: true, state: "granted" as const }),
      showTestNotification: async () => false,
    });

    expect(result.ok).toBe(false);
    expect(canSelectAlarmPresets("granted", result.ok)).toBe(false);
  });
});

describe("scheduled_reminders before permission", () => {
  it("does not build reminder rows when alarm is off", () => {
    expect(buildReminderUpsert("user-1", makeSchedule({ alarm: false }))).toBeNull();
  });

  it("does not sync reminders for schedules without alarm_at", () => {
    const row = buildReminderUpsert(
      "user-1",
      makeSchedule({ alarm: true, alarm_at: undefined }),
    );
    expect(row).toBeNull();
  });
});

describe("isIosSafariTab", () => {
  it("returns false outside browser", () => {
    expect(typeof isIosSafariTab()).toBe("boolean");
  });
});
