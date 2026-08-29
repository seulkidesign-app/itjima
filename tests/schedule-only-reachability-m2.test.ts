import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Existing schedule-only legacy rows (no source_id, no matching inbox) must stay
 * reachable after the unified Schedule IA. New schedule creation no longer
 * depends on the removed Schedule Quick Add, and legacy rows must never gain a
 * fabricated canonical source just because they are edited.
 */
describe("M2 schedule-only row reachability", () => {
  const scheduleSource = readFileSync(
    resolve(process.cwd(), "src/routes/schedule.tsx"),
    "utf8",
  );

  it("keeps legacy schedule-only rows reachable through the detail-first row flow", () => {
    expect(scheduleSource).not.toContain("openQuickAdd");
    expect(scheduleSource).toContain(
      "onOpenDetail={() => setDetailSchedule(schedule)}",
    );
    expect(scheduleSource).toContain("canonicalIdFromSchedule(detailSchedule)");
  });

  it("edits schedule-only rows in place when no matching canonical exists", () => {
    const branchStart = scheduleSource.indexOf(
      "const hasCanonical = inbox.allItems.some",
    );
    expect(branchStart).toBeGreaterThan(-1);

    const branchEnd = scheduleSource.indexOf("return {", branchStart);
    expect(branchEnd).toBeGreaterThan(branchStart);

    const editBranch = scheduleSource.slice(branchStart, branchEnd);
    expect(editBranch).toContain("if (hasCanonical)");
    expect(editBranch).toContain("syncRecordTemporal(");
    expect(editBranch).toContain("} else {");

    const fallbackBranch = editBranch.slice(editBranch.indexOf("} else {"));
    expect(fallbackBranch).toContain("await update(pending.edit.id");
    expect(fallbackBranch).not.toContain("source_id:");
  });
});
