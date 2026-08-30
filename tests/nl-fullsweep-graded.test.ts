import { describe, expect, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import {
  cleanScheduleTitle,
  hasNaturalScheduleTime,
} from "@/lib/naturalScheduleDraft";
import { shouldShowInlinePromise } from "@/lib/promiseCard";
import { scheduleConfirmationReasons } from "@/lib/nlScheduleSafety";
import {
  NL_FULLSWEEP_CASES,
  type FullsweepCase,
  type FullsweepGrade,
} from "./fixtures/nl-fullsweep-cases";

const MORNING = new Date(2026, 7, 30, 8, 0, 0);
const EVENING = new Date(2026, 7, 30, 20, 0, 0);

function resolveNow(c: FullsweepCase): Date {
  if (c.now === "evening") return EVENING;
  if (c.now === "morning") return MORNING;
  if (c.category.includes("past-time-only")) return EVENING;
  return MORNING;
}

function isDaypartCategory(category: string): boolean {
  return /daypart/i.test(category);
}

export type FullsweepResult = {
  input: string;
  category: string;
  grade: FullsweepGrade;
  detail?: string;
};

export function gradeFullsweepCase(c: FullsweepCase): FullsweepResult {
  const now = resolveNow(c);
  const actualExplicit = hasNaturalScheduleTime(c.input);
  const decision = evaluateTimedAutoCommit(c.input, "ko", now);
  const actualAuto = decision.ok;
  const actualInline =
    c.inlinePromise === undefined
      ? undefined
      : shouldShowInlinePromise(c.input, "ko");
  const reasons = scheduleConfirmationReasons(c.input, now);
  const title = cleanScheduleTitle(c.input);

  const failReasons: string[] = [];

  if (actualAuto !== c.auto) {
    failReasons.push(`auto expected=${c.auto} actual=${actualAuto}`);
  }
  if (actualExplicit !== c.explicitTime) {
    failReasons.push(
      `explicitTime expected=${c.explicitTime} actual=${actualExplicit}`,
    );
  }
  if (
    c.inlinePromise !== undefined &&
    actualInline !== c.inlinePromise
  ) {
    failReasons.push(
      `inlinePromise expected=${c.inlinePromise} actual=${actualInline}`,
    );
  }
  if (isDaypartCategory(c.category) && actualExplicit) {
    failReasons.push("daypart with explicitTime true");
  }
  if (c.auto && actualAuto && decision.ok) {
    if (
      c.autoStartHour !== undefined &&
      decision.draft.start.getHours() !== c.autoStartHour
    ) {
      failReasons.push(
        `startHour expected=${c.autoStartHour} actual=${decision.draft.start.getHours()}`,
      );
    }
    if (
      c.autoStartMinute !== undefined &&
      decision.draft.start.getMinutes() !== c.autoStartMinute
    ) {
      failReasons.push(
        `startMinute expected=${c.autoStartMinute} actual=${decision.draft.start.getMinutes()}`,
      );
    }
    if (
      c.autoEndHour !== undefined &&
      decision.draft.end.getHours() !== c.autoEndHour
    ) {
      failReasons.push(
        `endHour expected=${c.autoEndHour} actual=${decision.draft.end.getHours()}`,
      );
    }
  }
  if (
    !c.auto &&
    c.confirmationReason &&
    !reasons.includes(c.confirmationReason)
  ) {
    failReasons.push(
      `confirmationReason missing ${c.confirmationReason} (got ${reasons.join(",") || "none"})`,
    );
  }

  if (failReasons.length > 0) {
    return {
      input: c.input,
      category: c.category,
      grade: "FAIL",
      detail: failReasons.join("; "),
    };
  }

  const titleMissing =
    c.auto &&
    !c.titleDebt &&
    (c.titleMustContain ?? []).some((needle) => !title.includes(needle));

  if (c.titleDebt || titleMissing) {
    return {
      input: c.input,
      category: c.category,
      grade: "TITLE_FAIL",
      detail: titleMissing
        ? `title missing ${c.titleMustContain?.filter((n) => !title.includes(n)).join(",")}`
        : "titleDebt",
    };
  }

  return {
    input: c.input,
    category: c.category,
    grade: c.auto ? "FULL_PASS" : "SAFE",
  };
}

describe("NL fullsweep graded corpus (P0-A)", () => {
  it("grades all cases with zero FAIL", () => {
    const results = NL_FULLSWEEP_CASES.map(gradeFullsweepCase);

    const counts = {
      total: results.length,
      FULL_PASS: results.filter((r) => r.grade === "FULL_PASS").length,
      SAFE: results.filter((r) => r.grade === "SAFE").length,
      TITLE_FAIL: results.filter((r) => r.grade === "TITLE_FAIL").length,
      FAIL: results.filter((r) => r.grade === "FAIL").length,
    };

    const titleFails = results.filter((r) => r.grade === "TITLE_FAIL");
    const fails = results.filter((r) => r.grade === "FAIL");

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        ...counts,
        TITLE_FAIL_inputs: titleFails.map((r) => r.input),
        FAIL_details: fails.map((r) => ({
          input: r.input,
          detail: r.detail,
        })),
      }),
    );

    expect(counts.FAIL, JSON.stringify(fails, null, 2)).toBe(0);
    expect(counts.total).toBeGreaterThanOrEqual(200);
  });
});
