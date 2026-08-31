import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { parseCanonicalTemporalModel } from "@/lib/nlTemporalCalendarModel";
import { resolveCanonicalTemporalCandidate } from "@/lib/nlTemporalResolver";
import { NL_FULLSWEEP_CASES } from "./fixtures/nl-fullsweep-cases";

const ANCHORS = [
  { label: "mon-2026-08-24", now: new Date(2026, 7, 24, 8, 0, 0, 0) },
  { label: "tue-2026-08-25", now: new Date(2026, 7, 25, 8, 0, 0, 0) },
  { label: "fri-2026-08-28", now: new Date(2026, 7, 28, 8, 0, 0, 0) },
  { label: "sun-2026-08-30", now: new Date(2026, 7, 30, 8, 0, 0, 0) },
  { label: "mon-2026-08-31", now: new Date(2026, 7, 31, 8, 0, 0, 0) },
] as const;

const AUTO_CASES = NL_FULLSWEEP_CASES.filter((testCase) => testCase.auto);

function buildRows() {
  vi.useFakeTimers();
  try {
    return ANCHORS.flatMap((anchor) =>
      AUTO_CASES.map((testCase) => {
        vi.setSystemTime(anchor.now);
        const legacy = evaluateTimedAutoCommit(
          testCase.input,
          testCase.lang ?? "ko",
          anchor.now,
        );
        const candidate = resolveCanonicalTemporalCandidate(
          testCase.input,
          anchor.now,
        );

        const legacyStart = legacy.ok ? legacy.draft.start : null;
        const legacyEnd = legacy.ok ? legacy.draft.end : null;
        const startDeltaMs =
          legacyStart && candidate
            ? candidate.start.getTime() - legacyStart.getTime()
            : null;
        const compareEnd = Boolean(
          legacy.ok && candidate?.end && testCase.autoEndHour !== undefined,
        );
        const endDeltaMs =
          compareEnd && legacyEnd
            ? candidate!.end!.getTime() - legacyEnd.getTime()
            : null;
        const equivalent =
          legacy.ok &&
          Boolean(candidate) &&
          startDeltaMs === 0 &&
          (!compareEnd || endDeltaMs === 0);

        return {
          anchor: anchor.label,
          category: testCase.category,
          input: testCase.input,
          legacyAuto: legacy.ok,
          legacyReason: legacy.ok ? null : legacy.reason,
          legacyStart: legacyStart?.toISOString() ?? null,
          candidateStart: candidate?.start.toISOString() ?? null,
          legacyEnd: compareEnd ? legacyEnd?.toISOString() ?? null : null,
          candidateEnd: compareEnd ? candidate?.end?.toISOString() ?? null : null,
          precision: candidate?.precision ?? null,
          startDeltaMs,
          endDeltaMs,
          equivalent,
        };
      }),
    );
  } finally {
    vi.useRealTimers();
  }
}

const rows = buildRows();
const mismatches = rows.filter((row) => !row.equivalent);

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/nl-temporal-calendar-anchor-audit.json",
  JSON.stringify(
    {
      anchors: ANCHORS.map((anchor) => anchor.label),
      autoCases: AUTO_CASES.length,
      comparisons: rows.length,
      equivalent: rows.length - mismatches.length,
      mismatches: mismatches.length,
      mismatchRate: rows.length ? mismatches.length / rows.length : 0,
      rows: mismatches,
    },
    null,
    2,
  ),
);

describe("P0-J calendar-anchor timestamp matrix", () => {
  it("preserves explicit week scope before timestamp resolution", () => {
    expect(
      parseCanonicalTemporalModel(
        "다음 주 월요일 오전 9시에 출근",
        ANCHORS[0].now,
      ).date,
    ).toMatchObject({
      kind: "next_week_weekday",
      raw: "다음 주 월요일",
    });

    expect(
      parseCanonicalTemporalModel(
        "이번 주 금요일 오후 3시 회의",
        ANCHORS[0].now,
      ).date,
    ).toMatchObject({
      kind: "this_week_weekday",
      raw: "이번 주 금요일",
    });
  });

  it("covers all currently auto-committed cases across every anchor", () => {
    expect(AUTO_CASES.length).toBe(38);
    expect(rows.length).toBe(AUTO_CASES.length * ANCHORS.length);
    expect(rows.length).toBe(190);
  });

  it("requires zero cross-anchor timestamp mismatches before authority migration", () => {
    console.log(
      JSON.stringify({
        anchors: ANCHORS.length,
        autoCases: AUTO_CASES.length,
        comparisons: rows.length,
        equivalent: rows.length - mismatches.length,
        mismatches: mismatches.length,
        mismatchRate: rows.length ? mismatches.length / rows.length : 0,
        sample: mismatches.slice(0, 20),
      }),
    );
    expect(mismatches).toHaveLength(0);
  });
});