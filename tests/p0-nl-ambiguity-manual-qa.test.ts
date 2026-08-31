import { describe, expect, it } from "vitest";
import {
  canAutoCommitTimedCapture,
  evaluateTimedAutoCommit,
} from "@/lib/nlAutoCommit";
import { getNlClarificationPresentation } from "@/lib/nlClarificationPresentation";
import { scheduleConfirmationReasons } from "@/lib/nlScheduleSafety";
import { understandNaturalLanguage } from "@/lib/nlSchedule";
import { shouldShowInlinePromise } from "@/lib/promiseCard";

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

  it("Case B: 8시에 걷기 운동 is fail-closed AND the pending question is visible", () => {
    const text = "8시에 걷기 운동";
    // Bare clock is detected (8시) but date + meridiem stay unresolved.
    expect(scheduleConfirmationReasons(text)).toContain("assumed_meridiem");
    expect(canAutoCommitTimedCapture(text, "ko")).toBe(false);
    const decision = evaluateTimedAutoCommit(text, "ko");
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("assumed_meridiem");

    // Regression for the production integration bug: generic promise heuristics
    // classify this as a task, so parser-requested clarification must override
    // that visibility decision once clarification_state is pending.
    expect(shouldShowInlinePromise(text, "ko")).toBe(false);
    const presentation = getNlClarificationPresentation(text, "ko", "pending");
    expect(presentation.parserRequestedConfirmation).toBe(true);
    expect(presentation.shouldSurface).toBe(true);
    expect(presentation.confirmationReason).toBe("assumed_meridiem");
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

  it("Case E: 두 시 회의 uses the same visible AM/PM clarification", () => {
    const text = "두 시 회의";
    const decision = evaluateTimedAutoCommit(text, "ko");
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("assumed_meridiem");

    const presentation = getNlClarificationPresentation(text, "ko", "pending");
    expect(presentation.confirmationText).toContain("2시");
    expect(presentation.confirmationReason).toBe("assumed_meridiem");
    expect(presentation.shouldSurface).toBe(true);
  });

  it("Case F: 두 시안 비교 remains a non-clock noun collision", () => {
    const text = "두 시안 비교";
    const decision = evaluateTimedAutoCommit(text, "ko");
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).not.toBe("assumed_meridiem");

    // Even a stale/incorrect pending flag must not manufacture a clock reason.
    const presentation = getNlClarificationPresentation(text, "ko", "pending");
    expect(presentation.confirmationReason).toBeNull();
    expect(presentation.parserRequestedConfirmation).toBe(false);
    expect(presentation.shouldSurface).toBe(false);
  });
});
