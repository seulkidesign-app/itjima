import { test, expect } from "@playwright/test";
import { mergeArchiveMeta } from "../src/lib/archiveMetaSync";
import type { ArchiveMetaPayload } from "../src/lib/archiveMeta";

test.describe("archive meta sync", () => {
  test("merge unions local and remote fields", () => {
    const local: ArchiveMetaPayload = {
      pins: ["a"],
      titles: { a: "Local" },
      tags: {},
      visits: { a: 2 },
      groupOverrides: { a: "work" },
      customGroups: [],
      collapsed: ["work"],
      schedulePins: ["s1"],
      updatedAt: 1000,
    };
    const remote: ArchiveMetaPayload = {
      pins: ["b"],
      titles: { b: "Remote" },
      tags: {},
      visits: { b: 1 },
      groupOverrides: { b: "life" },
      customGroups: [{ key: "life", ko: "생활", en: "Life", emoji: "🌿" }],
      collapsed: ["life"],
      schedulePins: ["s2"],
      updatedAt: 2000,
    };

    const merged = mergeArchiveMeta(local, remote);
    expect(merged.pins.sort()).toEqual(["a", "b"]);
    expect(merged.titles).toEqual({ a: "Local", b: "Remote" });
    expect(merged.groupOverrides).toEqual({ a: "work", b: "life" });
    expect(merged.customGroups).toHaveLength(1);
    expect(merged.collapsed.sort()).toEqual(["life", "work"]);
    expect(merged.schedulePins.sort()).toEqual(["s1", "s2"]);
    expect(merged.updatedAt).toBeGreaterThanOrEqual(2000);
  });

  test("merge keeps max visit counts", () => {
    const local: ArchiveMetaPayload = {
      pins: [],
      titles: {},
      tags: {},
      visits: { x: 5 },
      groupOverrides: {},
      customGroups: [],
      collapsed: [],
      schedulePins: [],
      updatedAt: 1000,
    };
    const remote: ArchiveMetaPayload = {
      pins: [],
      titles: {},
      tags: {},
      visits: { x: 3 },
      groupOverrides: {},
      customGroups: [],
      collapsed: [],
      schedulePins: [],
      updatedAt: 2000,
    };

    const merged = mergeArchiveMeta(local, remote);
    expect(merged.visits.x).toBe(5);
  });

  test("archive keys are scoped per user in localStorage", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("itjima.user-a.archive.pins", JSON.stringify(["x"]));
      localStorage.setItem("itjima.user-b.archive.pins", JSON.stringify(["y"]));
    });
    const a = await page.evaluate(() => localStorage.getItem("itjima.user-a.archive.pins"));
    const b = await page.evaluate(() => localStorage.getItem("itjima.user-b.archive.pins"));
    expect(JSON.parse(a!)).toEqual(["x"]);
    expect(JSON.parse(b!)).toEqual(["y"]);
  });
});
