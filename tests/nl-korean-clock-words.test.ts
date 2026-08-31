import { describe, expect, it, vi } from "vitest";
import { normalizeKoreanClockWordsForParsing } from "@/lib/nlKoreanTemporalNormalization";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { resolveCanonicalTemporalCandidate } from "@/lib/nlTemporalResolver";

const NOW = new Date(2026, 7, 30, 8, 0, 0, 0);

describe("P0.5 Korean spoken clock words", () => {
  it("normalizes all twelve conversational Korean clock numbers", () => {
    const cases: Array<[string, string]> = [
      ["한 시", "1시"],
      ["두 시", "2시"],
      ["세 시", "3시"],
      ["네 시", "4시"],
      ["다섯 시", "5시"],
      ["여섯 시", "6시"],
      ["일곱 시", "7시"],
      ["여덟 시", "8시"],
      ["아홉 시", "9시"],
      ["열 시", "10시"],
      ["열한 시", "11시"],
      ["열두 시", "12시"],
    ];
    for (const [input, expected] of cases) {
      expect(normalizeKoreanClockWordsForParsing(input)).toBe(expected);
    }
  });

  it("does not turn durations or the word 한시적 into clocks", () => {
    expect(normalizeKoreanClockWordsForParsing("세시간 공부")).toBe("세시간 공부");
    expect(normalizeKoreanClockWordsForParsing("한 시간 뒤 출발")).toBe("한 시간 뒤 출발");
    expect(normalizeKoreanClockWordsForParsing("한시적으로 닫기")).toBe("한시적으로 닫기");
  });

  it("auto-commits an exact spoken Korean clock through canonical authority", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const decision = evaluateTimedAutoCommit("내일 오후 세 시 치과", "ko", NOW);
      expect(decision.ok).toBe(true);
      if (!decision.ok) return;
      expect(decision.draft.start).toEqual(new Date(2026, 7, 31, 15, 0, 0, 0));
      expect(decision.draft.text).toBe("치과");
      const canonical = resolveCanonicalTemporalCandidate("내일 오후 세 시 치과", NOW);
      expect(canonical?.start).toEqual(decision.draft.start);
    } finally {
      vi.useRealTimers();
    }
  });

  it("supports compact spoken half-hours without inventing anything", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const decision = evaluateTimedAutoCommit("내일 오후 열한시 반 출발", "ko", NOW);
      expect(decision.ok).toBe(true);
      if (decision.ok) {
        expect(decision.draft.start).toEqual(new Date(2026, 7, 31, 23, 30, 0, 0));
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a bare spoken clock under AM/PM clarification", () => {
    const decision = evaluateTimedAutoCommit("내일 세 시 병원", "ko", NOW);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("assumed_meridiem");
  });

  it("keeps approximate spoken clocks non-exact", () => {
    const decision = evaluateTimedAutoCommit("내일 다섯시쯤 병원", "ko", NOW);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("approximate_time");
  });

  it("supports a canonical spoken-clock range with inherited meridiem", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const decision = evaluateTimedAutoCommit(
        "내일 오후 세시부터 네시까지 운동",
        "ko",
        NOW,
      );
      expect(decision.ok).toBe(true);
      if (!decision.ok) return;
      expect(decision.draft.start).toEqual(new Date(2026, 7, 31, 15, 0, 0, 0));
      expect(decision.draft.end).toEqual(new Date(2026, 7, 31, 16, 0, 0, 0));
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not promote named noon to an invented exact clock", () => {
    const decision = evaluateTimedAutoCommit("내일 정오에 점심", "ko", NOW);
    expect(decision.ok).toBe(false);
  });

  it("still blocks contradictory spoken clocks", () => {
    const decision = evaluateTimedAutoCommit(
      "내일 오후 세시 아니 네시 병원",
      "ko",
      NOW,
    );
    expect(decision.ok).toBe(false);
  });
});
