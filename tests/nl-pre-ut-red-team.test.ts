import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { cleanScheduleTitle } from "@/lib/naturalScheduleDraft";
import {
  NL_PRE_UT_RED_TEAM_CASES,
  RED_TEAM_NOW,
  type RedTeamCase,
} from "./fixtures/nl-pre-ut-red-team-cases";

export type RedTeamGrade = "FULL_PASS" | "SAFE" | "TITLE_FAIL" | "FAIL";

export type RedTeamResult = {
  family: string;
  input: string;
  grade: RedTeamGrade;
  detail?: string;
  ok: boolean;
  reason?: string;
  start?: string;
  title?: string;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayOffsetBetween(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function gradeRedTeamCase(c: RedTeamCase): RedTeamResult {
  const now = c.now ?? RED_TEAM_NOW;
  const lang = c.lang ?? (/[가-힣]/.test(c.input) ? "ko" : "en");
  const decision = evaluateTimedAutoCommit(c.input, lang, now);
  const title = decision.ok
    ? decision.draft.text
    : cleanScheduleTitle(c.input);

  const base = {
    family: c.family,
    input: c.input,
    ok: decision.ok,
    reason: decision.ok ? undefined : decision.reason,
    start: decision.ok ? decision.draft.start.toISOString() : undefined,
    title,
  };

  if (c.expect.kind === "safe") {
    if (decision.ok) {
      const hour = decision.draft.start.getHours();
      const forbidden = c.expect.forbiddenHours?.includes(hour);
      return {
        ...base,
        grade: "FAIL",
        detail: forbidden
          ? `unsafe auto-commit hour=${hour} (forbidden silent corruption)`
          : `auto expected=false actual=true hour=${hour} title=${decision.draft.text}`,
      };
    }
    if (
      c.expect.expectedTitle !== undefined &&
      title !== c.expect.expectedTitle
    ) {
      return {
        ...base,
        grade: "TITLE_FAIL",
        detail: `title expected=${c.expect.expectedTitle} actual=${title}`,
      };
    }
    if (c.expect.titleMustContain) {
      for (const part of c.expect.titleMustContain) {
        if (!title.includes(part)) {
          return {
            ...base,
            grade: "TITLE_FAIL",
            detail: `title missing "${part}" actual=${title}`,
          };
        }
      }
    }
    return { ...base, grade: "SAFE" };
  }

  // expect.kind === "auto"
  if (!decision.ok) {
    return {
      ...base,
      grade: "FAIL",
      detail: `auto expected=true actual=false reason=${decision.reason}`,
    };
  }

  const failParts: string[] = [];
  if (decision.draft.start.getHours() !== c.expect.hour) {
    failParts.push(
      `hour expected=${c.expect.hour} actual=${decision.draft.start.getHours()}`,
    );
  }
  if (
    c.expect.minute !== undefined &&
    decision.draft.start.getMinutes() !== c.expect.minute
  ) {
    failParts.push(
      `minute expected=${c.expect.minute} actual=${decision.draft.start.getMinutes()}`,
    );
  }
  if (c.expect.dayOffset !== undefined) {
    const actualOffset = dayOffsetBetween(now, decision.draft.start);
    if (actualOffset !== c.expect.dayOffset) {
      failParts.push(
        `dayOffset expected=${c.expect.dayOffset} actual=${actualOffset}`,
      );
    }
  }
  if (decision.draft.start.getTime() <= now.getTime()) {
    failParts.push("canonical start is not in the future");
  }
  if (
    c.expect.expectedTitle !== undefined &&
    decision.draft.text !== c.expect.expectedTitle
  ) {
    return {
      ...base,
      grade: "TITLE_FAIL",
      detail: `title expected=${c.expect.expectedTitle} actual=${decision.draft.text}`,
    };
  }
  if (c.expect.titleMustContain) {
    for (const part of c.expect.titleMustContain) {
      if (!decision.draft.text.includes(part)) {
        return {
          ...base,
          grade: "TITLE_FAIL",
          detail: `title missing "${part}" actual=${decision.draft.text}`,
        };
      }
    }
  }
  if (failParts.length) {
    return { ...base, grade: "FAIL", detail: failParts.join("; ") };
  }
  return { ...base, grade: "FULL_PASS" };
}

const graded = NL_PRE_UT_RED_TEAM_CASES.map(gradeRedTeamCase);

const summary = {
  total: graded.length,
  FULL_PASS: graded.filter((r) => r.grade === "FULL_PASS").length,
  SAFE: graded.filter((r) => r.grade === "SAFE").length,
  TITLE_FAIL: graded.filter((r) => r.grade === "TITLE_FAIL").length,
  FAIL: graded.filter((r) => r.grade === "FAIL").length,
  unsafeAutoCommits: graded.filter(
    (r) => r.grade === "FAIL" && r.ok === true,
  ).length,
  failures: graded.filter(
    (r) => r.grade === "FAIL" || r.grade === "TITLE_FAIL",
  ),
};

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/nl-pre-ut-red-team-report.json",
  JSON.stringify(summary, null, 2),
);

describe("Pre-UT Red Team Gate", () => {
  it("keeps a substantial adversarial floor", () => {
    expect(NL_PRE_UT_RED_TEAM_CASES.length).toBeGreaterThanOrEqual(80);
  });

  graded.forEach((result, index) => {
    it(`[${result.family}] #${index + 1} ${result.input.replace(/\s+/g, " ").slice(0, 72)}`, () => {
      expect(
        result.grade === "FULL_PASS" || result.grade === "SAFE",
        JSON.stringify(result, null, 2),
      ).toBe(true);
    });
  });

  it("reports zero FAIL / TITLE_FAIL / unsafeAutoCommits", () => {
    expect(summary.FAIL).toBe(0);
    expect(summary.TITLE_FAIL).toBe(0);
    expect(summary.unsafeAutoCommits).toBe(0);
  });
});
