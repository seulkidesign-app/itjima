import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const push = source("src/lib/push/pushSubscription.ts");
const sheet = source("src/components/ScheduleAlarmSheet.tsx");

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

  it("offers a device-only notification test without claiming server delivery", () => {
    expect(push).toContain("export async function showDeviceNotificationTest");
    expect(push).toContain("await reg.showNotification");
    expect(push).toContain("This does not claim that the scheduled server sender is running");
    expect(sheet).toContain("이 기기에서 테스트 알림 보내기");
    expect(sheet).toContain("기기 연결은 정상이에요");
  });
});
