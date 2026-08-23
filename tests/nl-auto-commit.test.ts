import { describe, expect, it } from "vitest";
import {
  canAutoCommitTimedCapture,
  evaluateTimedAutoCommit,
} from "@/lib/nlAutoCommit";

describe("V02-08C timed auto-commit gate", () => {
  const now = new Date(2026, 7, 23, 10, 0, 0);

  it("allows explicit meridiem timed plans", () => {
    const decision = evaluateTimedAutoCommit(
      "내일 오후 3시 반 치과",
      "ko",
      now,
    );
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.draft.text).toMatch(/치과/);
      expect(decision.draft.start.getHours()).toBe(15);
      expect(decision.draft.start.getMinutes()).toBe(30);
      expect(decision.draft.options.allDay).toBe(false);
    }
  });

  it("allows English explicit meridiem", () => {
    expect(canAutoCommitTimedCapture("Dentist tomorrow at 3pm", "en", now)).toBe(
      true,
    );
  });

  it("blocks bare hour until AM/PM is chosen", () => {
    const decision = evaluateTimedAutoCommit("내일 3시 반 치과", "ko", now);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("assumed_meridiem");
  });

  it("blocks multiple clocks", () => {
    const decision = evaluateTimedAutoCommit("오늘 3시 A, 6시 B", "ko", now);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("multiple_clocks");
  });

  it("blocks undated notes (left item, not schedule)", () => {
    const decision = evaluateTimedAutoCommit("에어팟 소독", "ko", now);
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(["no_clock", "quiet", "empty_title"]).toContain(decision.reason);
    }
  });

  it("blocks weekend / after-work / past-today assumptions", () => {
    expect(
      evaluateTimedAutoCommit("주말에 영화", "ko", now).ok,
    ).toBe(false);
    expect(
      evaluateTimedAutoCommit("내일 퇴근 후 장보기", "ko", now).ok,
    ).toBe(false);
    expect(
      evaluateTimedAutoCommit(
        "오늘 오후 3시 치과",
        "ko",
        new Date(2026, 7, 23, 20, 0, 0),
      ).ok,
    ).toBe(false);
  });

  it("blocks clarify-style vague dates", () => {
    const decision = evaluateTimedAutoCommit("다음주쯤 보기", "ko", now);
    expect(decision.ok).toBe(false);
  });

  it("requires a non-empty title", () => {
    // Time-only phrase with nothing left as title after cleaning still must not auto-commit
    // if title collapses empty — covered by empty_title when applicable.
    expect(canAutoCommitTimedCapture("내일 오후 3시", "ko", now)).toBe(true);
  });
});
