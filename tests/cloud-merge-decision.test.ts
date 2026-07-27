import { describe, expect, it } from "vitest";
import { mergeCloudRow } from "@/lib/cloudMerge";

describe("cloud merge decision metadata", () => {
  it("keeps local later decision when cloud schema omits optional fields", () => {
    const cloud = {
      id: "thought-1",
      text: "엄마한테 전화",
      images: [],
      created_at: "2026-07-27T01:00:00.000Z",
      status: "active",
    };
    const local = {
      ...cloud,
      decision: "later",
      decided_at: "2026-07-27T02:00:00.000Z",
      decision_source: "swipe",
      capture_state: "saved",
    };

    expect(mergeCloudRow(cloud, local, "inbox")).toMatchObject({
      decision: "later",
      decided_at: "2026-07-27T02:00:00.000Z",
      decision_source: "swipe",
      capture_state: "saved",
    });
  });

  it("does not overwrite decision metadata explicitly returned by cloud", () => {
    const cloud = {
      id: "thought-1",
      decision: "archive",
    };
    const local = {
      id: "thought-1",
      decision: "later",
    };

    expect(mergeCloudRow(cloud, local, "inbox")).toMatchObject({
      decision: "archive",
    });
  });
});
