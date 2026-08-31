import { describe, expect, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { buildTemporalCompletionDraft } from "@/lib/nlTemporalCompletion";
import { understandNaturalLanguage } from "@/lib/nlSchedule";
import { attachExactTemporalPatch } from "@/lib/recordTemporal";

const NOW = new Date(2026, 8, 1, 10, 0, 0, 0);

describe("Temporal completion contract", () => {
  it("keeps the timed gate frozen while completing understood date-only plans", () => {
    for (const input of ["내일 운동", "금요일 서류 제출", "9월 5일 신청"]) {
      expect(evaluateTimedAutoCommit(input, "ko", NOW).ok, input).toBe(false);
      const draft = buildTemporalCompletionDraft(input, "ko", NOW);
      expect(draft, input).not.toBeNull();
      if (!draft) continue;
      expect(draft.options.allDay, input).toBe(true);
      expect(draft.start.getHours(), input).toBe(0);
      expect(draft.end.getHours(), input).toBe(23);
    }
  });

  it("preserves date plus daypart without inventing a clock", () => {
    for (const input of ["내일 오후 운동", "오늘 저녁 운동"]) {
      expect(evaluateTimedAutoCommit(input, "ko", NOW).ok, input).toBe(false);
      const draft = buildTemporalCompletionDraft(input, "ko", NOW);
      expect(draft, input).not.toBeNull();
      if (!draft) continue;
      expect(draft.options.allDay, input).toBe(true);
      expect(draft.start.getHours(), input).toBe(0);
    }
  });

  it("asks only for the missing date when a daypart stands alone", () => {
    const nl = understandNaturalLanguage("오후에 운동", "ko");
    expect(nl.intent).toBe("schedule_clarify");
    expect(nl.clarifyMissing).toBe("day");
    expect(nl.mirrorLine).toContain("오후");
    expect(buildTemporalCompletionDraft("오후에 운동", "ko", NOW)).toBeNull();
  });

  it("treats 이따가 as today-context with only time missing", () => {
    const nl = understandNaturalLanguage("이따가 운동", "ko");
    expect(nl.intent).toBe("schedule_clarify");
    expect(nl.clarifyMissing).toBe("time");
    expect(nl.mirrorLine).toContain("오늘");
    expect(buildTemporalCompletionDraft("이따가 운동", "ko", NOW)).toBeNull();
  });

  it("keeps existing AM/PM and noun-collision safety", () => {
    expect(evaluateTimedAutoCommit("내일 8시 운동", "ko", NOW)).toEqual({
      ok: false,
      reason: "assumed_meridiem",
    });
    expect(buildTemporalCompletionDraft("내일 두 시안 정리", "ko", NOW)).toBeNull();
  });

  it("keeps named exact instants out of fuzzy completion", () => {
    expect(buildTemporalCompletionDraft("내일 정오에 점심", "ko", NOW)).toBeNull();
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
