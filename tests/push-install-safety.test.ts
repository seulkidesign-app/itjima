import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const push = source("src/lib/push/pushSubscription.ts");
const sheet = source("src/components/ScheduleAlarmSheet.tsx");
const edge = source("supabase/functions/test-push/index.ts");
const supabaseConfig = source("supabase/config.toml");

describe("iPhone notification setup safety", () => {
  it("requires the Home Screen app before iOS push setup", () => {
    expect(push).toContain('detectPlatform() === "ios" && !isStandalonePwa()');
    expect(push).toContain('return "not_installed"');
    expect(sheet).toContain('support === "not_installed"');
    expect(sheet).toContain("Safari 하단의 공유 버튼");
    expect(sheet).toContain("홈 화면에 추가");
  });

  it("does not run preset or custom alarm setup before installation", () => {
    expect(sheet).toContain("if (installRequired)");
    expect(sheet).toContain("explainInstallation()");
    expect(sheet).toContain("const choosePreset");
    expect(sheet).toContain("const chooseCustom");
  });

  it("runs an authenticated end-to-end server push test", () => {
    expect(push).toContain("export async function sendServerPushTest");
    expect(push).toContain('supabase.functions.invoke("test-push"');
    expect(edge).toContain("userClient.auth.getUser()");
    expect(edge).toContain('from("push_subscriptions")');
    expect(edge).toContain("webpush.sendNotification");
    expect(supabaseConfig).toContain("[functions.test-push]");
    expect(supabaseConfig).toContain("verify_jwt = true");
    expect(sheet).toContain("서버까지 실제 푸시 테스트");
    expect(sheet).toContain("10초 안에 알림이 보여야 해요");
  });
});
