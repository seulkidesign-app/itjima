import { describe, expect, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { understandNaturalLanguage } from "@/lib/nlSchedule";
import { attachExactTemporalPatch } from "@/lib/recordTemporal";

const NOW = new Date(2026, 8, 1, 10, 0, 0, 0);

describe("Temporal completion contract", () => {
  it("promotes understood date-only plans without inventing a clock", () => {
    for (const input of ["내일 운동", "금요일 서류 제출", "9월 5일 신청"]) {
      const decision = evaluateTimedAutoCommit(input, "ko", NOW);
      expect(decision.ok, input).toBe(true);
      if (!decision.ok) continue;
      expect(decision.draft.options.allDay, input).toBe(true);
      expect(decision.draft.start.getHours(), input).toBe(0);
      expect(decision.draft.end.getHours(), input).toBe(23);
    }
  });

  it("preserves date plus daypart as fuzzy/all-day precision, not a fake clock", () => {
    for (const input of ["내일 오후 운동", "오늘 저녁 운동"]) {
      const decision = evaluateTimedAutoCommit(input, "ko", NOW);
      expect(decision.ok, input).toBe(true);
      if (!decision.ok) continue;
      expect(decision.draft.options.allDay, input).toBe(true);
      expect(decision.draft.start.getHours(), input).toBe(0);
    }
  });

  it("asks only for the missing date when a daypart stands alone", () => {
    const nl = understandNaturalLanguage("오후에 운동", "ko");
    expect(nl.intent).toBe("schedule_clarify");
    expect(nl.clarifyMissing).toBe("day");
    expect(nl.mirrorLine).toContain("오후");

    const decision = evaluateTimedAutoCommit("오후에 운동", "ko", NOW);
    expect(decision).toEqual({ ok: false, reason: "clarify_intent" });
  });

  it("treats 이따가 as today-context with only time missing", () => {
    const nl = understandNaturalLanguage("이따가 운동", "ko");
    expect(nl.intent).toBe("schedule_clarify");
    expect(nl.clarifyMissing).toBe("time");
    expect(nl.mirrorLine).toContain("오늘");

    const decision = evaluateTimedAutoCommit("이따가 운동", "ko", NOW);
    expect(decision).toEqual({ ok: false, reason: "clarify_intent" });
  });

  it("keeps existing AM/PM and noun-collision safety", () => {
    expect(evaluateTimedAutoCommit("내일 8시 운동", "ko", NOW)).toEqual({
      ok: false,
      reason: "assumed_meridiem",
    });
    expect(evaluateTimedAutoCommit("두 시안 비교", "ko", NOW).ok).toBe(false);
  });

  it("keeps invalid bare minutes fail-closed", () => {
    expect(evaluateTimedAutoCommit("13시 66분 미팅", "ko", NOW)).toEqual({
      ok: false,
      reason: "invalid_clock",
    });
  });

  it("stores date-only and fuzzy precision distinctly on canonical records", () => {
    const dateOnly = attachExactTemporalPatch({
      text: "내일 운동",
      start_time: new Date(2026, 8, 2, 0, 0).toISOString(),
      end_time: new Date(2026, 8, 2, 23, 59).toISOString(),
      all_day: true,
    });
    expect(dateOnly.temporal_state).toBe("date_only");

    const fuzzy = attachExactTemporalPatch({
      text: "내일 오후 운동",
      start_time: new Date(2026, 8, 2, 0, 0).toISOString(),
      end_time: new Date(2026, 8, 2, 23, 59).toISOString(),
      all_day: true,
    });
    expect(fuzzy.temporal_state).toBe("fuzzy_time");
  });
});
