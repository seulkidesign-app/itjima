import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { parseNlTemporalModel, type NlTemporalModel } from "@/lib/nlTemporalModel";
import {
  NL_FULLSWEEP_CASES,
  type FullsweepCase,
} from "./fixtures/nl-fullsweep-cases";

const MORNING = new Date(2026, 7, 30, 8, 0, 0, 0);
const EVENING = new Date(2026, 7, 30, 20, 0, 0, 0);

const KO_WEEKDAY: Record<string, number> = {
  일: 0,
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6,
};

const EN_WEEKDAY: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function resolveNow(testCase: FullsweepCase): Date {
  if (testCase.now === "evening") return EVENING;
  if (testCase.now === "morning") return MORNING;
  if (testCase.category.includes("past-time-only")) return EVENING;
  return MORNING;
}

function atStartOfDay(now: Date): Date {
  const value = new Date(now);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(now: Date, amount: number): Date {
  const value = atStartOfDay(now);
  value.setDate(value.getDate() + amount);
  return value;
}

function resolveWeekday(raw: string, now: Date): Date | null {
  const ko = raw.match(/(일|월|화|수|목|금|토)요일/);
  const en = raw.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  const target = ko ? KO_WEEKDAY[ko[1]] : en ? EN_WEEKDAY[en[1].toLowerCase()] : undefined;
  if (target === undefined) return null;

  const value = atStartOfDay(now);
  const delta = (target - value.getDay() + 7) % 7;
  value.setDate(value.getDate() + delta);
  return value;
}

function resolveModelDate(model: NlTemporalModel, now: Date): Date | null {
  const date = model.date;
  if (!date) return atStartOfDay(now);

  switch (date.kind) {
    case "today":
      return atStartOfDay(now);
    case "tomorrow":
      return addDays(now, 1);
    case "day_after_tomorrow":
      return addDays(now, 2);
    case "three_days_later":
      return addDays(now, 3);
    case "weekday":
      return resolveWeekday(date.raw, now);
    case "full_date": {
      const match = date.raw.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
      if (!match) return null;
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
    }
    case "month_day": {
      const ko = date.raw.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
      const slash = date.raw.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
      const month = Number((ko ?? slash)?.[1]);
      const day = Number((ko ?? slash)?.[2]);
      if (!month || !day) return null;
      const value = new Date(now.getFullYear(), month - 1, day, 0, 0, 0, 0);
      if (value.getTime() < atStartOfDay(now).getTime()) value.setFullYear(value.getFullYear() + 1);
      return value;
    }
    case "next_month_day": {
      const match = date.raw.match(/다음\s*달\s*(\d{1,2})\s*일/);
      if (!match) return null;
      return new Date(now.getFullYear(), now.getMonth() + 1, Number(match[1]), 0, 0, 0, 0);
    }
    default:
      return null;
  }
}

function resolveCanonicalCandidate(
  text: string,
  now: Date,
): { start: Date; end: Date | null; precision: string } | null {
  const model = parseNlTemporalModel(text, now);
  if (model.ambiguities.length > 0 || model.deadline || model.recurrence) return null;

  if (model.relativeOffset) {
    const unitMs =
      model.relativeOffset.unit === "minute"
        ? 60_000
        : model.relativeOffset.unit === "hour"
          ? 60 * 60_000
          : 24 * 60 * 60_000;
    return {
      start: new Date(now.getTime() + model.relativeOffset.amount * unitMs),
      end: null,
      precision: model.precision,
    };
  }

  const date = resolveModelDate(model, now);
  if (!date) return null;

  if (model.range?.supportedSyntax && model.range.resolved) {
    if (model.range.start?.kind !== "exact" || model.range.end?.kind !== "exact") return null;
    const start = new Date(date);
    start.setHours(model.range.start.hour24, model.range.start.minute, 0, 0);
    const end = new Date(date);
    end.setHours(model.range.end.hour24, model.range.end.minute, 0, 0);
    if (end.getTime() <= start.getTime()) return null;
    return { start, end, precision: model.precision };
  }

  if (!model.exactClock) return null;
  const start = new Date(date);
  start.setHours(model.exactClock.hour24, model.exactClock.minute, 0, 0);
  return { start, end: null, precision: model.precision };
}

function buildRows() {
  vi.useFakeTimers();
  try {
    return NL_FULLSWEEP_CASES.flatMap((testCase) => {
      const now = resolveNow(testCase);
      // Legacy detectDate/buildNaturalScheduleDraft call new Date() internally.
      // Freeze the process clock so both legacy and canonical candidates are
      // evaluated against the exact same deterministic reference time.
      vi.setSystemTime(now);

      const decision = evaluateTimedAutoCommit(testCase.input, testCase.lang ?? "ko", now);
      if (!decision.ok) return [];

      const candidate = resolveCanonicalCandidate(testCase.input, now);
      const startDeltaMs = candidate
        ? candidate.start.getTime() - decision.draft.start.getTime()
        : null;
      const compareEnd = Boolean(candidate?.end && testCase.autoEndHour !== undefined);
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
  it("covers every currently expected auto-commit in the locked corpus", () => {
    const expectedAutoCount = NL_FULLSWEEP_CASES.filter((testCase) => testCase.auto).length;
    expect(rows.length).toBe(expectedAutoCount);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("prints timestamp equivalence without granting timestamp authority", () => {
    console.log(
      JSON.stringify({
        totalAuto: rows.length,
        equivalent: rows.length - mismatches.length,
        mismatches: mismatches.length,
        mismatchRate: rows.length ? mismatches.length / rows.length : 0,
        sample: mismatches.slice(0, 20),
      }),
    );
    expect(mismatches.length).toBeGreaterThanOrEqual(0);
  });
});
