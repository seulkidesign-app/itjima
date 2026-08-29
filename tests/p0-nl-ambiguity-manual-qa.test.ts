import { describe, expect, it } from "vitest";
import {
  canAutoCommitTimedCapture,
  evaluateTimedAutoCommit,
} from "@/lib/nlAutoCommit";
import { scheduleConfirmationReasons } from "@/lib/nlScheduleSafety";
import { understandNaturalLanguage } from "@/lib/nlSchedule";

/**
 * POST-319 Manual QA · P0-4 — natural-language ambiguity safety regression.
 * Never invent AM/PM or dates the user did not say.
 */
describe("P0-4 NL ambiguity safety (manual QA)", () => {
  it("Case A: 내일 8시 기상 asks AM/PM and does not auto-commit", () => {
    const text = "내일 8시 기상";
    expect(canAutoCommitTimedCapture(text, "ko")).toBe(false);
    expect(scheduleConfirmationReasons(text)).toContain("assumed_meridiem");
    expect(evaluateTimedAutoCommit(text, "ko").ok).toBe(false);
  });

  it("Case B: 8시에 걷기 운동 detects clock but never auto-schedules", () => {
    const text = "8시에 걷기 운동";
    // Bare clock is detected (8시) but date + meridiem stay unresolved.
    expect(scheduleConfirmationReasons(text)).toContain("assumed_meridiem");
    expect(canAutoCommitTimedCapture(text, "ko")).toBe(false);
    expect(evaluateTimedAutoCommit(text, "ko").ok).toBe(false);
  });

  it("Case C: 오후에 운동 stays a safe note — no invented datetime", () => {
    const text = "오후에 운동";
    expect(canAutoCommitTimedCapture(text, "ko")).toBe(false);
    const nl = understandNaturalLanguage(text, "ko");
    expect(nl.intent === "schedule_exact").toBe(false);
    expect(evaluateTimedAutoCommit(text, "ko").ok).toBe(false);
  });

  it("Case D: 내일 오후 8시 기상 is clear and may schedule", () => {
    const text = "내일 오후 8시 기상";
    expect(scheduleConfirmationReasons(text)).toEqual([]);
    expect(canAutoCommitTimedCapture(text, "ko")).toBe(true);
    const decision = evaluateTimedAutoCommit(text, "ko");
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.draft.options.allDay).toBe(false);
      expect(decision.draft.start.getHours()).toBe(20);
    }
  });
});
