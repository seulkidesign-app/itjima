import { describe, expect, it } from "vitest";
import {
  mockExtract,
  editCandidate,
  confirmCandidate,
  buildPayload,
  reviewComplete,
  validDate,
  imageError,
  type Draft,
} from "../src/domain/brief";
export function reviewed() {
  let d = mockExtract({ text: "원본 브리프", images: [] });
  for (const c of d.candidates) {
    if (c.group === "schedules")
      d = editCandidate(d, c.id, {
        dueDate: c.id === "draft_due" ? "2026-10-20" : "2026-10-23",
      });
    if (c.id === "usage_rights")
      d = editCandidate(d, c.id, { informationState: "not_mentioned" });
    d = confirmCandidate(d, c.id);
  }
  return d;
}
describe("review boundary", () => {
  it.each(["", " \n\t "])("requires a source %j", (text) =>
    expect(() => mockExtract({ text, images: [] })).toThrow(),
  );
  it("preserves source whitespace", () =>
    expect(mockExtract({ text: "  원문\n ", images: [] }).source.text).toBe(
      "  원문\n ",
    ));
  it("initial candidates cannot construct final payload", () =>
    expect(() =>
      buildPayload(mockExtract({ text: "가이드", images: [] }), "브랜드"),
    ).toThrow());
  it("requires each date without automatically assigning a year", () => {
    let d = mockExtract({ text: "가이드", images: [] });
    expect(() => confirmCandidate(d, "draft_due")).toThrow();
    d = editCandidate(d, "draft_due", { dueDate: "2026-10-20" });
    d = confirmCandidate(d, "draft_due");
    expect(d.candidates[0].reviewState).toBe("edited");
    expect(d.candidates[1].reviewState).toBe("unreviewed");
    expect(reviewComplete(d)).toBe(false);
  });
  it("distinguishes unchanged confirmation, edit and re-review", () => {
    let d = confirmCandidate(
      mockExtract({ text: "가이드", images: [] }),
      "film",
    );
    expect(d.candidates.find((c) => c.id === "film")?.reviewState).toBe(
      "confirmed",
    );
    d = editCandidate(d, "film", { value: "영상 2편" });
    expect(d.candidates.find((c) => c.id === "film")?.reviewState).toBe(
      "unreviewed",
    );
    d = confirmCandidate(d, "film");
    expect(d.candidates.find((c) => c.id === "film")).toMatchObject({
      reviewState: "edited",
      originalValue: "릴스 영상 촬영·편집",
    });
  });
  it("requires a collaboration name and all mandatory candidates", () => {
    expect(() => buildPayload(reviewed(), " ")).toThrow();
    const d = { ...reviewed(), candidates: reviewed().candidates.slice(0, -1) };
    expect(reviewComplete(d)).toBe(false);
  });
  it("builds separate date tasks, constraints and review with no inferred time", () => {
    const p = buildPayload(reviewed(), "브랜드 A");
    expect(p.tasks.filter((t) => t.due_date).map((t) => t.due_date)).toEqual([
      "2026-10-20",
      "2026-10-23",
    ]);
    expect(p.constraints.find((c) => c.type === "usage_rights")).toMatchObject({
      value: null,
      information_state: "not_mentioned",
    });
    expect(p.review.every((r) => r.evidence === null)).toBe(true);
    expect(p.source.raw_text).toBe("원본 브리프");
  });
  it("uncertain dates are audit-only, not scheduled tasks", () => {
    let d = editCandidate(reviewed(), "draft_due", {
      informationState: "uncertain",
    });
    d = confirmCandidate(d, "draft_due");
    const p = buildPayload(d, "브랜드");
    expect(p.tasks.some((t) => t.candidate_id === "draft_due")).toBe(false);
    expect(p.review[0]).toMatchObject({
      information_state: "uncertain",
      value: null,
      due_date: null,
    });
  });
  it("rejects empty value after editing", () => {
    const d = editCandidate(reviewed(), "film", { value: "  " });
    expect(() => confirmCandidate(d, "film")).toThrow();
    expect(() => buildPayload(d, "브랜드")).toThrow();
  });
  it.each(["2026-02-30", "2026-13-01", "10-20", ""])(
    "rejects invalid date %s",
    (value) => expect(validDate(value)).toBe(false),
  );
  it("handles leap dates without rollover", () => {
    expect(validDate("2028-02-29")).toBe(true);
    expect(validDate("2026-02-29")).toBe(false);
  });
  it("never treats an empty draft as reviewed", () => {
    const d: Draft = { ...reviewed(), candidates: [] };
    expect(reviewComplete(d)).toBe(false);
  });
  it.each(["text/html", "image/svg+xml", "application/pdf"])(
    "rejects image type %s",
    (type) => expect(imageError({ type, size: 100 })).not.toBeNull(),
  );
  it.each([0, 10485761])("rejects image size %s", (size) =>
    expect(imageError({ type: "image/png", size })).not.toBeNull(),
  );
  it("accepts bounded screenshot input", () =>
    expect(imageError({ type: "image/png", size: 1000 })).toBeNull());
});
