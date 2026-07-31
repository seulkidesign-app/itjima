import { describe, expect, it } from "vitest";
import { scheduleConfirmationReason } from "@/lib/nlScheduleSafety";
import { shouldShowInlinePromise } from "@/lib/promiseCard";

describe("natural-language schedule safety", () => {
  const now = new Date("2026-07-31T20:00:00+09:00");

  it("asks before silently moving a past time", () => {
    expect(scheduleConfirmationReason("오늘 오후 3시 치과", now)).toBe(
      "past_today",
    );
  });

  it("asks which weekend day", () => {
    expect(scheduleConfirmationReason("주말에 수진이 만나기", now)).toBe(
      "weekend_day",
    );
  });

  it("does not assume the user's after-work time", () => {
    expect(scheduleConfirmationReason("내일 퇴근 후 장보기", now)).toBe(
      "after_work_time",
    );
  });

  it("asks before assuming PM for a bare early hour", () => {
    expect(scheduleConfirmationReason("내일 3시에 치과", now)).toBe(
      "assumed_meridiem",
    );
  });

  it("allows an explicit future time to use one-tap creation", () => {
    expect(scheduleConfirmationReason("내일 오후 3시에 치과", now)).toBeNull();
  });
});

describe("focused inline understanding", () => {
  it("shows schedules and tasks", () => {
    expect(shouldShowInlinePromise("내일 오후 3시에 치과", "ko")).toBe(true);
    expect(shouldShowInlinePromise("엄마한테 전화하기", "ko")).toBe(true);
  });

  it("keeps archive and plain-note interpretations quiet", () => {
    expect(shouldShowInlinePromise("여권 번호", "ko")).toBe(false);
    expect(shouldShowInlinePromise("그냥 떠오른 생각", "ko")).toBe(false);
  });
});
