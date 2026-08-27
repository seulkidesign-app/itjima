import { describe, expect, it } from "vitest";
import {
  scheduleConfirmationChoices,
  scheduleConfirmationReason,
  scheduleConfirmationReasons,
} from "@/lib/nlScheduleSafety";
import { shouldShowInlinePromise } from "@/lib/promiseCard";

describe("natural-language schedule safety", () => {
  // Construct local wall-clock time so the test is stable in UTC and Asia/Seoul CI.
  const now = new Date(2026, 6, 31, 20, 0, 0);

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

  it("asks AM or PM before deciding that a bare time has passed", () => {
    expect(scheduleConfirmationReasons("오늘 3시에 치과", now)).toEqual([
      "assumed_meridiem",
    ]);
  });

  it("allows an explicit future time to use one-tap creation", () => {
    expect(scheduleConfirmationReason("내일 오후 3시에 치과", now)).toBeNull();
  });
});

describe("inline ambiguity resolution", () => {
  const now = new Date(2026, 6, 31, 20, 0, 0);

  it("moves a passed today time to tomorrow without losing the clock time", () => {
    const choices = scheduleConfirmationChoices(
      "오늘 오후 3시 치과",
      "past_today",
      "ko",
      now,
    );

    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({
      id: "tomorrow_same_time",
      label: "내일 같은 시간",
      resolvedText: "내일 오후 3시 치과",
    });
    expect(scheduleConfirmationReason(choices[0].resolvedText, now)).toBeNull();
  });

  it("offers Saturday and Sunday for a weekend plan", () => {
    const choices = scheduleConfirmationChoices(
      "주말에 수진이 만나기",
      "weekend_day",
      "ko",
      now,
    );

    expect(choices.map((choice) => choice.label)).toEqual([
      "토요일",
      "일요일",
    ]);
    expect(choices.map((choice) => choice.resolvedText)).toEqual([
      "이번 주 토요일에 수진이 만나기",
      "이번 주 일요일에 수진이 만나기",
    ]);
  });

  it("offers practical after-work times", () => {
    const choices = scheduleConfirmationChoices(
      "내일 퇴근 후 장보기",
      "after_work_time",
      "ko",
      now,
    );

    expect(choices.map((choice) => choice.resolvedText)).toEqual([
      "내일 오후 6시 장보기",
      "내일 오후 7시 장보기",
    ]);
  });

  it("offers AM, PM, and no-time without inventing a meridiem", () => {
    const choices = scheduleConfirmationChoices(
      "내일 3시에 치과",
      "assumed_meridiem",
      "ko",
      now,
    );

    expect(choices.map((choice) => choice.label)).toEqual([
      "오전 3시",
      "오후 3시",
      "시간 없이",
    ]);
    expect(choices.map((choice) => choice.resolvedText)).toEqual([
      "내일 오전 3시에 치과",
      "내일 오후 3시에 치과",
      "내일 치과",
    ]);
  });

  it("falls back to manual review when more than one assumption is present", () => {
    const text = "주말 퇴근 후 수진이 만나기";
    expect(scheduleConfirmationReasons(text, now)).toEqual([
      "weekend_day",
      "after_work_time",
    ]);
    expect(
      scheduleConfirmationChoices(text, "weekend_day", "ko", now),
    ).toEqual([]);
  });

  // V02-07: multi-clock inputs must not silently become one merged event
  it("flags multiple distinct clock times instead of merging them", () => {
    const text = "오늘 3시 A, 6시 B";
    expect(scheduleConfirmationReasons(text, now)).toContain("multiple_clocks");
    expect(
      scheduleConfirmationChoices(text, "multiple_clocks", "ko", now),
    ).toEqual([]);
  });

  it("does not flag a single 시 반 phrase as multiple clocks", () => {
    expect(
      scheduleConfirmationReasons("내일 3시 반 치과", now),
    ).not.toContain("multiple_clocks");
  });
});

describe("focused inline understanding", () => {
  it("shows schedules that still need a question", () => {
    expect(shouldShowInlinePromise("내일 오후 3시에 치과", "ko")).toBe(true);
    expect(shouldShowInlinePromise("내일 3시 반 치과", "ko")).toBe(true);
  });

  it("keeps undated notes quiet (no task taxonomy card)", () => {
    expect(shouldShowInlinePromise("엄마한테 전화하기", "ko")).toBe(false);
    expect(shouldShowInlinePromise("에어팟 소독", "ko")).toBe(false);
  });

  it("keeps archive and plain-note interpretations quiet", () => {
    expect(shouldShowInlinePromise("여권 번호", "ko")).toBe(false);
    expect(shouldShowInlinePromise("그냥 떠오른 생각", "ko")).toBe(false);
  });
});
