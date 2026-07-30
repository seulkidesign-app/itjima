import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatIosPwaDeliverySummary,
  iosPwaDeliverySucceeded,
} from "@/lib/push/iosPwaPushTest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("ios-pwa push diagnostics", () => {
  it("edge function targets ios-pwa only from JWT user", () => {
    const edge = source("supabase/functions/test-push-ios/index.ts");
    expect(edge).toContain('eq("platform", IOS_PWA_PLATFORM)');
    expect(edge).toContain("auth.getUser()");
    expect(edge).not.toContain("p_endpoint");
    expect(edge).toContain("deliveries");
    expect(edge).toContain("잊지마 알림 테스트");
  });

  it("process-reminders reports per-platform delivery results", () => {
    const cron = source("supabase/functions/process-reminders/index.ts");
    expect(cron).toContain("platform");
    expect(cron).toContain("reminderDeliveries");
    expect(cron).toContain("reminderMarkedSent");
  });

  it("ScheduleAlarmSheet uses ios-only immediate test path", () => {
    const sheet = source("src/components/ScheduleAlarmSheet.tsx");
    expect(sheet).toContain('detectPushPlatform() === "ios-pwa"');
    expect(sheet).toContain("runIosPwaImmediatePushTest");
    expect(sheet).toContain("pollIosPwaScheduledPushTest");
  });

  it("summarizes ios-pwa acceptance without secrets", () => {
    expect(
      iosPwaDeliverySucceeded([
        {
          platform: "ios-pwa",
          attempted: true,
          accepted: true,
          statusCode: 201,
          errorType: null,
          errorMessage: null,
        },
      ]),
    ).toBe(true);

    const summary = formatIosPwaDeliverySummary(
      [
        {
          platform: "ios-pwa",
          attempted: true,
          accepted: false,
          statusCode: 410,
          errorType: "subscription_expired",
          errorMessage: null,
        },
      ],
      "ko",
    );
    expect(summary).toContain("subscription_expired");
    expect(summary).not.toMatch(/https?:\/\//);
  });
});
