import { describe, expect, it, vi } from "vitest";
import type { NaturalScheduleDraft } from "@/lib/naturalScheduleDraft";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { applyCanonicalTemporalAuthority } from "@/lib/nlTemporalAuthority";
import { resolveCanonicalTemporalCandidate } from "@/lib/nlTemporalResolver";
import { NL_FULLSWEEP_CASES } from "./fixtures/nl-fullsweep-cases";

const baseOptions: NaturalScheduleDraft["options"] = {
  reminderMinutes: 0,
  allDay: false,
  startAllDay: false,
  endAllDay: false,
  repeat: null,
};

function legacyDraft(start: Date, end: Date): NaturalScheduleDraft {
  return {
    text: "테스트",
    start,
    end,
    reminderExplicit: false,
    options: baseOptions,
  };
}

describe("P0-K canonical temporal timestamp authority", () => {
  it("replaces a deliberately wrong legacy start while preserving duration policy", () => {
    const now = new Date(2026, 7, 30, 8, 0, 0, 0);
    const legacy = legacyDraft(
      new Date(2030, 0, 1, 1, 0, 0, 0),
      new Date(2030, 0, 1, 2, 0, 0, 0),
    );

    const promoted = applyCanonicalTemporalAuthority(
      "내일 오후 3시 치과",
      legacy,
      now,
    );

    expect(promoted).not.toBeNull();
    expect(promoted!.start).toEqual(new Date(2026, 7, 31, 15, 0, 0, 0));
    expect(promoted!.end).toEqual(new Date(2026, 7, 31, 16, 0, 0, 0));
  });

  it("lets the canonical range own both start and end", () => {
    const now = new Date(2026, 7, 30, 8, 0, 0, 0);
    const legacy = legacyDraft(
      new Date(2030, 0, 1, 1, 0, 0, 0),
      new Date(2030, 0, 1, 5, 0, 0, 0),
    );

    const promoted = applyCanonicalTemporalAuthority(
      "내일 오후 5시부터 6시까지 운동",
      legacy,
      now,
    );

    expect(promoted).not.toBeNull();
    expect(promoted!.start).toEqual(new Date(2026, 7, 31, 17, 0, 0, 0));
    expect(promoted!.end).toEqual(new Date(2026, 7, 31, 18, 0, 0, 0));
  });

  it("fails closed when the canonical model cannot resolve an exact timestamp", () => {
    const now = new Date(2026, 7, 30, 8, 0, 0, 0);
    const legacy = legacyDraft(
      new Date(2026, 7, 31, 15, 0, 0, 0),
      new Date(2026, 7, 31, 16, 0, 0, 0),
    );

    expect(
      applyCanonicalTemporalAuthority("내일 오후에 청소", legacy, now),
    ).toBeNull();
  });

  it("uses canonical relative-offset timestamps", () => {
    const now = new Date(2026, 7, 30, 8, 0, 0, 0);
    const legacy = legacyDraft(
      new Date(2030, 0, 1, 1, 0, 0, 0),
      new Date(2030, 0, 1, 2, 0, 0, 0),
    );

    const promoted = applyCanonicalTemporalAuthority("30분 뒤에 전화", legacy, now);
    expect(promoted).not.toBeNull();
    expect(promoted!.start).toEqual(new Date(2026, 7, 30, 8, 30, 0, 0));
    expect(promoted!.end).toEqual(new Date(2026, 7, 30, 9, 30, 0, 0));
  });

  it("keeps production auto-commit on canonical timestamps across five anchors", () => {
    const anchors = [
      new Date(2026, 7, 24, 8, 0, 0, 0),
      new Date(2026, 7, 25, 8, 0, 0, 0),
      new Date(2026, 7, 28, 8, 0, 0, 0),
      new Date(2026, 7, 30, 8, 0, 0, 0),
      new Date(2026, 7, 31, 8, 0, 0, 0),
    ];
    const autoCases = NL_FULLSWEEP_CASES.filter((testCase) => testCase.auto);
    const failures: Array<{ input: string; anchor: string; reason: string }> = [];

    vi.useFakeTimers();
    try {
      for (const now of anchors) {
        vi.setSystemTime(now);
        for (const testCase of autoCases) {
          const decision = evaluateTimedAutoCommit(
            testCase.input,
            testCase.lang ?? "ko",
            now,
          );
          const candidate = resolveCanonicalTemporalCandidate(testCase.input, now);
          if (!decision.ok || !candidate) {
            failures.push({
              input: testCase.input,
              anchor: now.toISOString(),
              reason: !decision.ok ? decision.reason : "candidate_missing",
            });
            continue;
          }
          if (decision.draft.start.getTime() !== candidate.start.getTime()) {
            failures.push({
              input: testCase.input,
              anchor: now.toISOString(),
              reason: "start_mismatch",
            });
          }
          if (
            candidate.end &&
            decision.draft.end.getTime() !== candidate.end.getTime()
          ) {
            failures.push({
              input: testCase.input,
              anchor: now.toISOString(),
              reason: "range_end_mismatch",
            });
          }
        }
      }
    } finally {
      vi.useRealTimers();
    }

    expect(autoCases).toHaveLength(38);
    expect(autoCases.length * anchors.length).toBe(190);
    expect(failures, JSON.stringify(failures.slice(0, 20), null, 2)).toEqual([]);
  });
});
