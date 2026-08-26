import { describe, expect, it } from "vitest";
import {
  getBrowsableRecords,
  searchCanonicalRecords,
} from "@/lib/canonicalBrowse";
import type { InboxItem } from "@/lib/store";

function item(
  partial: Partial<InboxItem> & { id: string; text: string },
): InboxItem {
  return {
    images: [],
    created_at: "2026-08-20T01:00:00.000Z",
    status: "active",
    ...partial,
  };
}

describe("canonical browse", () => {
  const rows: InboxItem[] = [
    item({ id: "a", text: "call mom", status: "active", created_at: "2026-08-21T01:00:00.000Z" }),
    item({
      id: "b",
      text: "dentist",
      status: "done",
      start_time: "2026-08-22T06:00:00.000Z",
      created_at: "2026-08-20T01:00:00.000Z",
    }),
    item({ id: "c", text: "gone", status: "deleted" }),
    item({ id: "d", text: "vaulted", status: "archived" }),
  ];

  it("returns active + done only, newest first", () => {
    const browsable = getBrowsableRecords(rows);
    expect(browsable.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("does not invent schedule duplicates", () => {
    const browsable = getBrowsableRecords(rows);
    expect(browsable).toHaveLength(2);
    expect(browsable.filter((r) => r.id === "b")).toHaveLength(1);
  });

  it("searches active and done; excludes deleted", () => {
    expect(searchCanonicalRecords(rows, "dentist").map((r) => r.id)).toEqual([
      "b",
    ]);
    expect(searchCanonicalRecords(rows, "gone")).toEqual([]);
    expect(searchCanonicalRecords(rows, "").map((r) => r.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
