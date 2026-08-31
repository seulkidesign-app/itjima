import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { evaluateLegacyTimedAutoCommit } from "@/lib/nlAutoCommit";
import { resolveCanonicalTemporalCandidate } from "@/lib/nlTemporalResolver";
import {
  NL_FULLSWEEP_CASES,
  type FullsweepCase,
} from "./fixtures/nl-fullsweep-cases";

const MORNING = new Date(2026, 7, 30, 8, 0, 0, 0);
const EVENING = new Date(2026, 7, 30, 20, 0, 0, 0);

function resolveNow(testCase: FullsweepCase): Date {
  if (testCase.now === "evening") return EVENING;
  if (testCase.now === "morning") return MORNING;
  if (testCase.category.includes("past-time-only")) return EVENING;
  return MORNING;
}

function buildRows() {
  vi.useFakeTimers();
  try {
    return NL_FULLSWEEP_CASES.flatMap((testCase) => {
      const now = resolveNow(testCase);
      vi.setSystemTime(now);

      const decision = evaluateLegacyTimedAutoCommit(
        testCase.input,
        testCase.lang ?? "ko",
        now,
      );
      if (!decision.ok) return [];

      const candidate = resolveCanonicalTemporalCandidate(testCase.input, now);
      const startDeltaMs = candidate
        ? candidate.start.getTime() - decision.draft.start.getTime()
        : null;
      const compareEnd = Boolean(
        candidate?.end && testCase.autoEndHour !== undefined,
      );
      const endDeltaMs = compareEnd
        ? candidate!.end!.getTime() - decision.draft.end.getTime()
        : null;

      return [
        {
          category: testCase.category,
          input: testCase.input,
          legacyStart: decision.draft.start.toISOString(),
          legacyEnd: decision.draft.end.toISOString(),
          candidateStart: candidate?.start.toISOString() ?? null,
          candidateEnd: candidate?.end?.toISOString() ?? null,
          precision: candidate?.precision ?? null,
          candidateResolved: Boolean(candidate),
          startDeltaMs,
          endDeltaMs,
          equivalent:
            Boolean(candidate) &&
            startDeltaMs === 0 &&
            (!compareEnd || endDeltaMs === 0),
        },
      ];
    });
  } finally {
    vi.useRealTimers();
  }
}

const rows = buildRows();
const mismatches = rows.filter((row) => !row.equivalent);

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/nl-temporal-timestamp-equivalence.json",
  JSON.stringify(
    {
      corpus: "nl-fullsweep-auto-only",
      totalAuto: rows.length,
      equivalent: rows.length - mismatches.length,
      mismatches: mismatches.length,
      mismatchRate: rows.length ? mismatches.length / rows.length : 0,
      rows: mismatches,
    },
    null,
    2,
  ),
);

describe("P0-I temporal timestamp equivalence audit", () => {
  it("covers every currently expected legacy auto-commit in the locked corpus", () => {
    const expectedAutoCount = NL_FULLSWEEP_CASES.filter(
      (testCase) => testCase.auto,
    ).length;
    expect(rows.length).toBe(expectedAutoCount);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("keeps the independent legacy-versus-canonical timestamp audit green", () => {
    console.log(
      JSON.stringify({
        totalAuto: rows.length,
        equivalent: rows.length - mismatches.length,
        mismatches: mismatches.length,
        mismatchRate: rows.length ? mismatches.length / rows.length : 0,
        sample: mismatches.slice(0, 20),
      }),
    );
    expect(mismatches).toHaveLength(0);
  });
});
