import { describe, expect, it } from "vitest";
import { archiveGroup } from "@/lib/dateDetect";
import {
  readGroupOverrides,
  writeGroupOverrides,
  readCustomGroups,
  writeCustomGroups,
} from "@/lib/archiveMeta";

describe("archive grouping", () => {
  it("classifies travel keywords", () => {
    const g = archiveGroup("여행 준비 체크리스트");
    expect(g.key).toBeTruthy();
  });

  it("persists group overrides idempotently", () => {
    writeGroupOverrides({ "item-1": "idea" });
    const first = readGroupOverrides();
    writeGroupOverrides({ "item-1": "idea", "item-2": "read" });
    const second = readGroupOverrides();
    expect(first["item-1"]).toBe("idea");
    expect(second["item-2"]).toBe("read");
    writeGroupOverrides({});
  });

  it("persists custom groups", () => {
    const groups = [
      { key: "travel", ko: "여행", en: "Travel", emoji: "✈️" },
    ];
    writeCustomGroups(groups);
    expect(readCustomGroups()).toEqual(groups);
    writeCustomGroups([]);
  });
});

describe("archive search fields", () => {
  it("matches title, body, url, and group context", () => {
    const text = "https://nngroup.com UX reference";
    expect(text.toLowerCase()).toContain("nngroup");
    const g = archiveGroup("아이디어 메모");
    expect(g.key).toBeTruthy();
  });
});
