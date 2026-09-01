import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Existing schedule-only legacy rows (no source_id, no matching inbox) must stay
 * reachable after the unified Schedule IA. They are compatibility data, not a
 * second source of truth: the first meaningful edit heals the row by creating a
 * canonical record and reconnecting Schedule as its projection.
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

  it("heals a legacy standalone row into a canonical record when it is edited", () => {
    const branchStart = scheduleSource.indexOf(
      "const hasCanonical = inbox.allItems.some",
    );
    expect(branchStart).toBeGreaterThan(-1);

    const editBranch = scheduleSource.slice(
      branchStart,
      scheduleSource.indexOf("// Manual schedule creation", branchStart),
    );
    expect(editBranch).toContain("if (hasCanonical)");
    expect(editBranch).toContain("syncRecordTemporal(");
    expect(editBranch).toContain("createCanonicalForManualSchedule(");
    expect(editBranch).toContain("source_id: canonical.id");
    expect(editBranch).toContain("await update(pending.edit.id");
  });
});
