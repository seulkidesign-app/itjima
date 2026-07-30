import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const push = source("src/lib/push/pushSubscription.ts");
const sheet = source("src/components/ScheduleAlarmSheet.tsx");
const serverTest = source("src/lib/push/serverPushTest.ts");
const processReminders = source("supabase/functions/process-reminders/index.ts");
const edge = source("supabase/functions/test-push/index.ts");
const iosEdge = source("supabase/functions/test-push-ios/index.ts");
const supabaseConfig = source("supabase/config.toml");

describe("iPhone notification setup safety", () => {
  it("requires the Home Screen app before iOS push setup", () => {
    expect(push).toContain("requiresStandalonePwaForPush()");
    expect(push).toContain('return "not_installed"');
    expect(sheet).toContain("ios_install");
    expect(sheet).toContain("Safari 공유 버튼");
    expect(sheet).toContain("홈 화면에 추가");
  });

  it("does not run preset or custom alarm setup before permission is ready", () => {
    expect(sheet).toContain("canSelectAlarmPresets");
    expect(sheet).toContain("presetsEnabled");
    expect(sheet).toContain('data-testid="alarm-preset-custom"');
    expect(sheet).toContain("disabled={!presetsEnabled}");
  });

  it("runs scheduled server push diagnostics via cron queue", () => {
    expect(serverTest).toContain("startServerPushTest");
    expect(serverTest).toContain("SERVER_PUSH_TEST_SCHEDULE_ID");
    expect(serverTest).toContain("push-test:");
    expect(processReminders).toContain("SERVER_PUSH_TEST_SCHEDULE_ID");
    expect(processReminders).toContain('assertRelativeAppUrl("/schedule")');
    expect(processReminders).toContain('.from("schedules")');
    expect(sheet).toContain("1분 뒤 예약 알림 테스트");
    expect(sheet).toContain("이 기기에서 알림 표시 테스트");
  });

  it("Settings exposes notification settings with problem details on failure", () => {
    const settings = source("src/components/SettingsSheet.tsx");
    const deviceSheet = source("src/components/DeviceNotificationSheet.tsx");
    expect(settings).toContain("DeviceNotificationSheet");
    expect(settings).toContain("알림 설정");
    expect(settings).toContain('data-testid="settings-notification-settings-row"');
    expect(deviceSheet).toContain("PushProblemDetails");
    expect(deviceSheet).toContain("문제 확인하기");
    expect(deviceSheet).toContain("getNotificationSettingsStatus");
    expect(deviceSheet).toContain("테스트 알림 보내기");
    expect(deviceSheet).toContain("이 기기 알림 다시 연결");
    expect(deviceSheet).toContain("이 기기 알림 끄기");
    expect(deviceSheet).not.toContain('data-testid="push-live-diagnostics"');
  });

  it("requires standalone PWA only on iOS for push setup", () => {
    expect(push).toContain("requiresStandalonePwaForPush");
    expect(source("src/lib/push/directPushEnableFlow.ts")).toContain(
      "requiresStandalonePwaForPush",
    );
  });

  it("subscribePush validates auth session and registers via RPC", () => {
    expect(push).toContain("getSessionUserId");
    expect(push).toContain('code: "missing_vapid"');
    expect(push).toContain('code: "not_authenticated"');
    expect(push).toContain("logPushFailure");
    expect(push).toContain("detectPushPlatform");
    expect(push).toContain("persistPushSubscriptionViaRpc");
    expect(push).toContain("ensurePushSubscriptionForCurrentUser");
  });

  it("keeps authenticated immediate push test function available", () => {
    expect(push).toContain("export async function sendServerPushTest");
    expect(push).toContain('supabase.functions.invoke("test-push"');
    expect(edge).toContain("userClient.auth.getUser()");
    expect(edge).toContain('from("push_subscriptions")');
    expect(edge).toContain("webpush.sendNotification");
    expect(supabaseConfig).toContain("[functions.test-push]");
    expect(supabaseConfig).toContain("[functions.test-push-ios]");
    expect(iosEdge).toContain("ios-pwa");
    expect(iosEdge).toContain("deliveries");
    expect(supabaseConfig).toContain("verify_jwt = true");
  });
});
