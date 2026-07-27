import { describe, expect, it } from "vitest";
import { alarmAvailabilityHint } from "@/lib/alarmAvailability";

describe("alarm availability copy", () => {
  it("does not promise background alerts to signed-out users", () => {
    const copy = alarmAvailabilityHint("granted", false, "ko");
    expect(copy).toContain("앱을 열어둔 동안");
    expect(copy).toContain("로그인");
  });

  it("explains the iPhone Home Screen requirement", () => {
    const copy = alarmAvailabilityHint("not_installed", true, "ko");
    expect(copy).toContain("홈 화면");
    expect(copy).toContain("앱을 닫은 뒤");
  });

  it("states that the schedule remains when permission is denied", () => {
    const copy = alarmAvailabilityHint("denied", true, "ko");
    expect(copy).toContain("알림이 꺼져");
    expect(copy).toContain("일정은 그대로 저장");
  });

  it("uses conditional language even when permission is granted", () => {
    const copy = alarmAvailabilityHint("granted", true, "ko");
    expect(copy).toContain("지원되는 기기");
    expect(copy).not.toMatch(/반드시|무조건/);
  });
});
