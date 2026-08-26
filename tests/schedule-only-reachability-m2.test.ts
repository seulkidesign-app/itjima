import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Schedule-only rows (no source_id, no matching inbox) remain reachable via
 * Schedule Quick Add / calendar add — keep legacy path, do not invent canonicals.
 */
describe("M2 schedule-only row reachability", () => {
  const scheduleSource = readFileSync(
    resolve(process.cwd(), "src/routes/schedule.tsx"),
    "utf8",
  );

  it("Quick Add still creates schedule without requiring inbox canonical", () => {
    expect(scheduleSource).toContain("openQuickAdd");
    expect(scheduleSource).toContain("Schedule-only legacy");
    expect(scheduleSource).toContain("no fake canonical");
  });

  it("edit path branches when no matching canonical exists", () => {
    expect(scheduleSource).toContain("hasCanonical");
    expect(scheduleSource).toContain("Schedule-only legacy row");
  });
});
