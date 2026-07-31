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
  it("edge function sends immediate push and creates 3-minute scheduled reminder", () => {
    const edge = source("supabase/functions/test-push-ios/index.ts");
    expect(edge).toContain('eq("platform", IOS_PWA_PLATFORM)');
    expect(edge).toContain("includeScheduledTest");
    expect(edge).toContain("IOS_SCHEDULED_TEST_DELAY_MS");
    expect(edge).toContain('source: "server-web-push"');
    expect(edge).toContain("statusCode: 201");
    expect(edge).not.toContain("p_endpoint");
  });

  it("service worker shows push immediately without waiting for clients", () => {
    const sw = source("public/sw.js");
    expect(sw).toContain("itjima-shell-v4");
    expect(sw).toContain("self.skipWaiting()");
    expect(sw).toContain("event.waitUntil(showPushNotification");
    expect(sw).not.toContain("renotify");
  });

  it("ScheduleAlarmSheet uses server-only ios background test path", () => {
    const sheet = source("src/components/ScheduleAlarmSheet.tsx");
    expect(sheet).toContain("invokeIosPwaBackgroundPushTest");
    expect(sheet).not.toContain("runIosPwaImmediatePushTest");
  });

  it("ios-pwa disables page-level in-app reminder timers", () => {
    const schedule = source("src/routes/schedule.tsx");
    expect(schedule).toContain('detectPushPlatform() === "ios-pwa"');
    expect(schedule).toContain("bindInAppReminders");
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
      {
        deliveries: [
          {
            platform: "ios-pwa",
            attempted: true,
            accepted: false,
            statusCode: 410,
            errorType: "subscription_expired",
            errorMessage: null,
          },
        ],
      },
      "ko",
    );
    expect(summary).toContain("HTTP 410");
    expect(summary).not.toMatch(/https?:\/\//);
  });
});
