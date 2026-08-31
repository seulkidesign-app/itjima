import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { resolveNaturalScheduleStart } from "@/lib/naturalScheduleDraft";
import { buildTemporalShadowAudit } from "@/lib/nlTemporalShadow";
import { NL_FULLSWEEP_CASES } from "./fixtures/nl-fullsweep-cases";

const MORNING = new Date(2026, 7, 30, 10, 0, 0, 0);
const EVENING = new Date(2026, 7, 30, 20, 0, 0, 0);

const rows = NL_FULLSWEEP_CASES.map((testCase) => {
  const now = testCase.now === "evening" ? EVENING : MORNING;
  const lang = testCase.lang ?? "ko";
  const decision = evaluateTimedAutoCommit(testCase.input, lang, now);
  const legacyResolvedStart = resolveNaturalScheduleStart(testCase.input, now);
  const audit = buildTemporalShadowAudit(
    testCase.input,
    now,
    decision.ok
      ? { ok: true, start: decision.draft.start }
      : { ok: false, reason: decision.reason },
    legacyResolvedStart,
  );
  return {
    category: testCase.category,
    input: testCase.input,
    expectedAuto: testCase.auto,
    legacyAuto: decision.ok,
    mismatch: audit.mismatch,
    legacyReason: audit.legacyReason,
    legacyResolved: audit.legacyResolved,
    legacyHour: audit.legacyHour,
    legacyMinute: audit.legacyMinute,
    modelPrecision: audit.modelPrecision,
    modelDateKind: audit.modelDateKind,
    modelDaypart: audit.modelDaypart,
    modelResolvedTimed: audit.modelResolvedTimed,
    modelHour: audit.modelHour,
    modelMinute: audit.modelMinute,
    modelAmbiguities: audit.modelAmbiguities,
  };
});

const mismatchRows = rows.filter((row) => row.mismatch !== "none");
const mismatchCounts = Object.fromEntries(
  [...new Set(mismatchRows.map((row) => row.mismatch))].map((mismatch) => [
    mismatch,
    mismatchRows.filter((row) => row.mismatch === mismatch).length,
  ]),
);

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/nl-temporal-shadow-audit.json",
  JSON.stringify(
    {
      corpus: "nl-fullsweep",
      total: rows.length,
      mismatches: mismatchRows.length,
      mismatchRate: rows.length ? mismatchRows.length / rows.length : 0,
      mismatchCounts,
      rows: mismatchRows,
    },
    null,
    2,
  ),
);

describe("P0-F temporal shadow audit", () => {
  it("audits the full locked corpus without changing its contract", () => {
    expect(rows.length).toBe(NL_FULLSWEEP_CASES.length);
    expect(rows.length).toBeGreaterThanOrEqual(280);
  });

  it("keeps legacy decisions identical to the locked fullsweep expectations", () => {
    const drift = rows.filter((row) => row.legacyAuto !== row.expectedAuto);
    expect(drift, JSON.stringify(drift.slice(0, 20), null, 2)).toEqual([]);
  });

  it("prints the shadow migration baseline without gating on zero mismatches", () => {
    console.log(
      JSON.stringify({
        total: rows.length,
        mismatches: mismatchRows.length,
        mismatchRate: rows.length ? mismatchRows.length / rows.length : 0,
        mismatchCounts,
        sample: mismatchRows.slice(0, 20),
      }),
    );
    expect(mismatchRows.length).toBeGreaterThanOrEqual(0);
  });
});
