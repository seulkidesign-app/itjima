import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("direct iOS push enable flow", () => {
  it("requests permission before any React setState in the click handler", () => {
    const direct = source("src/lib/push/directPushEnableFlow.ts");
    const sheet = source("src/components/DeviceNotificationSheet.tsx");
    const settings = source("src/components/SettingsSheet.tsx");

    expect(direct).toContain("permission === \"default\"");
    expect(direct).toContain("await Notification.requestPermission()");
    expect(direct).toContain("matchMedia(\"(display-mode: standalone)\")");
    expect(sheet).toContain("executeDirectPushEnableFlow");
    expect(sheet).toContain("PushProblemDetails");
    expect(sheet).toContain("문제 확인하기");
    expect(settings).toContain("runDirectPushEnableFromSettings");
    expect(settings).not.toContain("setNotificationOpen(true);\n            tap();");
  });

  it("Settings runs the direct flow on first tap before opening the diagnostic sheet", () => {
    const settings = source("src/components/SettingsSheet.tsx");
    expect(settings).toContain("data-testid=\"settings-notification-settings-row\"");
    expect(settings).toContain("await runDirectPushEnableFromSettings(userId, lang)");
    expect(settings).toContain("setNotificationOpen(true)");
  });
});
