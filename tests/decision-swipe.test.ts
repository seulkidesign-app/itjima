import { describe, expect, it } from "vitest";
import {
  dragProgressForOutcome,
  previewDragOutcome,
  resolveDragAxis,
  resolveDragOutcome,
  shouldCommitDrag,
} from "@/lib/decision";

describe("decision swipe model", () => {
  const w = 320;
  const h = 360;

  it("maps right to schedule, left to archive, down to keep", () => {
    expect(resolveDragOutcome(110, 0, w, h, "horizontal")).toBe("today");
    expect(resolveDragOutcome(-110, 0, w, h, "horizontal")).toBe("archive");
    expect(resolveDragOutcome(0, 100, w, h, "vertical")).toBe("later");
  });

  it("locks axis by dominant movement", () => {
    expect(resolveDragAxis(40, 5, null)).toBe("horizontal");
    expect(resolveDragAxis(5, 40, null)).toBe("vertical");
  });

  it("preview ignores ambiguous small movement", () => {
    expect(previewDragOutcome(20, 18, w, h, null)).toBeNull();
  });

  it("commits on distance threshold", () => {
    expect(shouldCommitDrag(110, 0, 0, 0, w, h, "horizontal")).toBe("today");
    expect(shouldCommitDrag(-110, 0, 0, 0, w, h, "horizontal")).toBe("archive");
    expect(shouldCommitDrag(0, 100, 0, 0, w, h, "vertical")).toBe("later");
  });

  it("commits on high-velocity flick", () => {
    expect(shouldCommitDrag(40, 0, 800, 0, w, h, "horizontal")).toBe("today");
    expect(shouldCommitDrag(-40, 0, -800, 0, w, h, "horizontal")).toBe(
      "archive",
    );
    expect(shouldCommitDrag(0, 30, 0, 700, w, h, "vertical")).toBe("later");
  });

  it("returns null below commit threshold without velocity", () => {
    expect(shouldCommitDrag(50, 0, 0, 0, w, h, "horizontal")).toBeNull();
  });

  it("preview appears before commit threshold", () => {
    expect(previewDragOutcome(50, 0, w, h, "horizontal")).toBe("today");
    expect(shouldCommitDrag(50, 0, 0, 0, w, h, "horizontal")).toBeNull();
    expect(previewDragOutcome(0, 50, w, h, "vertical")).toBe("later");
    expect(shouldCommitDrag(0, 50, 0, 0, w, h, "vertical")).toBeNull();
  });

  it("drag progress scales toward 1 at threshold", () => {
    const p = dragProgressForOutcome(99, 0, "today", w, h);
    expect(p).toBeGreaterThan(0.9);
    expect(p).toBeLessThanOrEqual(1);
  });
});
