import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeScheduleInputForTrust,
  scheduleTrustIssue,
} from "@/lib/nlTrust";
import { buildNaturalScheduleDraft } from "@/lib/naturalScheduleDraft";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { scheduleConfirmationReason } from "@/lib/nlScheduleSafety";
import {
  clarifyPicksForText,
  dateFromClarifyPick,
  understandNaturalLanguage,
} from "@/lib/nlSchedule";
import type { InboxItem } from "@/lib/store";

function thought(text: string): InboxItem {
  return {
    id: "trust-thought",
    text,
    images: [],
    created_at: new Date().toISOString(),
    status: "active",
  };
}

describe("AI trust floor", () => {
  const now = new Date("2026-08-23T10:00:00+09:00");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes clear Korean dayparts before parsing the clock", () => {
    expect(normalizeScheduleInputForTrust("내일 저녁 7시 치과")).toBe(
      "내일 오후 7시 치과",
    );
    expect(normalizeScheduleInputForTrust("내일 밤 10시 약 먹기")).toBe(
      "내일 오후 10시 약 먹기",
    );
    expect(normalizeScheduleInputForTrust("내일 새벽 2시 공항")).toBe(
      "내일 오전 2시 공항",
    );
    expect(normalizeScheduleInputForTrust("내일 점심 11시 약속")).toBe(
      "내일 오전 11시 약속",
    );
    expect(normalizeScheduleInputForTrust("내일 점심 1시 약속")).toBe(
      "내일 오후 1시 약속",
    );
  });

  it("understands explicit Korean word-form clocks without guessing", () => {
    expect(normalizeScheduleInputForTrust("내일 오후 세시 치과")).toBe(
      "내일 오후 3시 치과",
    );
    expect(normalizeScheduleInputForTrust("내일 저녁 일곱 시 영화")).toBe(
      "내일 오후 7시 영화",
    );
    expect(normalizeScheduleInputForTrust("내일 오전 열한시 회의")).toBe(
      "내일 오전 11시 회의",
    );

    const decision = evaluateTimedAutoCommit("내일 오후 세시 치과", "ko", now);
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.draft.start.getHours()).toBe(15);
      expect(decision.draft.text).toBe("치과");
    }
  });

  it("never invents a clock for a broad morning phrase from real QA", () => {
    const input = "내일 아침 챙겨먹기";
    expect(scheduleTrustIssue(input, now)).toBe("broad_daypart");
    const decision = evaluateTimedAutoCommit(input, "ko", now);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("broad_daypart");

    const draft = buildNaturalScheduleDraft(thought(input));
    expect(draft.options.allDay).toBe(true);
    expect(draft.options.reminderMinutes).toBeNull();
  });

  it("never asks for the clock again when an exact clock is already explicit", () => {
    expect(scheduleConfirmationReason("내일 오후 3시 치과", now)).toBeNull();
    expect(scheduleConfirmationReason("내일 오전 11시 회의", now)).toBeNull();
    expect(scheduleConfirmationReason("내일 저녁 7시 영화", now)).toBeNull();
  });

  it("keeps schedule creation separate from reminder creation", () => {
    const scheduleOnly = buildNaturalScheduleDraft(thought("내일 오후 3시 치과"));
    expect(scheduleOnly.options.reminderMinutes).toBeNull();
    expect(scheduleOnly.reminderExplicit).toBe(false);

    const withReminder = buildNaturalScheduleDraft(
      thought("내일 오후 3시 치과 30분 전에 알려줘"),
    );
    expect(withReminder.options.reminderMinutes).toBe(30);
    expect(withReminder.reminderExplicit).toBe(true);
  });

  it("asks tomorrow vs day-after-tomorrow for colloquial near-day wording", () => {
    for (const input of ["내일 모레 청소하기", "내일모레 청소하기", "낼모레 청소하기"]) {
      const understanding = understandNaturalLanguage(input, "ko");
      expect(understanding.intent).toBe("schedule_clarify");
      expect(understanding.clarifyMissing).toBe("day");
      expect(clarifyPicksForText(input, "ko")).toEqual([
        { pick: "tomorrow", label: "내일" },
        { pick: "day_after_tomorrow", label: "모레" },
      ]);
    }

    const picked = dateFromClarifyPick("day_after_tomorrow", now);
    expect(picked.label).toBe("모레");
    expect(picked.start.getDate()).toBe(25);
  });

  it("treats a daypart without a concrete clock as ambiguous", () => {
    expect(scheduleTrustIssue("내일 오후에 치과", now)).toBe("broad_daypart");
    expect(scheduleTrustIssue("내일 저녁에 치과", now)).toBe("broad_daypart");
  });

  it("parses clear contextual daypart clocks to the intended hour", () => {
    expect(buildNaturalScheduleDraft(thought("내일 저녁 7시 치과")).start.getHours()).toBe(19);
    expect(buildNaturalScheduleDraft(thought("내일 밤 10시 약 먹기")).start.getHours()).toBe(22);
    expect(buildNaturalScheduleDraft(thought("내일 새벽 2시 공항")).start.getHours()).toBe(2);
    expect(buildNaturalScheduleDraft(thought("내일 점심 11시 약속")).start.getHours()).toBe(11);
    expect(buildNaturalScheduleDraft(thought("내일 점심 1시 약속")).start.getHours()).toBe(13);
  });

  it("does not guess Korean night phrases that cross a date boundary", () => {
    expect(normalizeScheduleInputForTrust("내일 밤 1시 귀가")).toBe(
      "내일 밤 1시 귀가",
    );
    expect(scheduleTrustIssue("내일 밤 1시 귀가", now)).toBe("day_boundary");
    expect(scheduleTrustIssue("내일 밤 12시 귀가", now)).toBe("day_boundary");

    const one = evaluateTimedAutoCommit("내일 밤 1시 귀가", "ko", now);
    expect(one.ok).toBe(false);
    if (!one.ok) expect(one.reason).toBe("day_boundary");
  });

  it("blocks conflicting daypart + clock phrases instead of forcing a period", () => {
    expect(scheduleTrustIssue("내일 새벽 8시 공항", now)).toBe(
      "daypart_conflict",
    );
    expect(scheduleTrustIssue("내일 저녁 3시 치과", now)).toBe(
      "daypart_conflict",
    );
  });

  it("removes normalized daypart/time words from the saved title", () => {
    expect(buildNaturalScheduleDraft(thought("내일 저녁 7시 치과")).text).toBe("치과");
    expect(buildNaturalScheduleDraft(thought("내일 새벽 2시 공항")).text).toBe("공항");
  });

  it("understands common compound relative offsets", () => {
    const ninety = buildNaturalScheduleDraft(thought("한 시간 반 뒤 엄마한테 전화"));
    expect(ninety.start.getTime()).toBe(now.getTime() + 90 * 60_000);
    expect(ninety.text).toBe("엄마한테 전화");

    const twoThirty = buildNaturalScheduleDraft(thought("2시간 30분 후 출발"));
    expect(twoThirty.start.getTime()).toBe(now.getTime() + 150 * 60_000);
    expect(twoThirty.text).toBe("출발");
  });

  it("blocks broad dayparts instead of inventing an exact hour", () => {
    expect(scheduleTrustIssue("내일 저녁에 치과", now)).toBe("broad_daypart");
    const decision = evaluateTimedAutoCommit("내일 저녁에 치과", "ko", now);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("broad_daypart");
  });

  it("blocks impossible dates rather than normalizing them", () => {
    expect(scheduleTrustIssue("2월 30일 오후 3시 치과", now)).toBe(
      "invalid_datetime",
    );
    expect(scheduleTrustIssue("13월 2일 오후 3시 치과", now)).toBe(
      "invalid_datetime",
    );
  });

  it("blocks impossible clocks rather than clamping or rolling them", () => {
    expect(scheduleTrustIssue("내일 오후 25시 치과", now)).toBe(
      "invalid_datetime",
    );
    expect(scheduleTrustIssue("내일 오후 3시 75분 치과", now)).toBe(
      "invalid_datetime",
    );
    expect(scheduleTrustIssue("내일 27:10 치과", now)).toBe(
      "invalid_datetime",
    );
  });

  it("allows clear contextual clocks to auto-commit after normalization", () => {
    const decision = evaluateTimedAutoCommit("내일 저녁 7시 치과", "ko", now);
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.draft.start.getHours()).toBe(19);
      expect(decision.draft.text).toBe("치과");
    }
  });
});
