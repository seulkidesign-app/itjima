import { describe, expect, test } from "vitest";
import { findCleanupDuplicateGroups } from "@/lib/cleanupReview";
import type { InboxItem } from "@/lib/store";

function item(
  id: string,
  text: string,
  patch: Partial<InboxItem> = {},
): InboxItem {
  return {
    id,
    text,
    images: [],
    created_at: `2026-08-${String(10 + Number(id.replace(/\D/g, "") || 0)).padStart(2, "0")}T12:00:00.000Z`,
    status: "active",
    temporal_state: "no_time",
    ...patch,
  };
}

describe("P2 cleanup review contract", () => {
  test("groups only exact normalized text duplicates", () => {
    const groups = findCleanupDuplicateGroups([
      item("1", "서울숲 카페 가보기"),
      item("2", "  서울숲   카페 가보기  "),
      item("3", "다른 기록"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((it) => it.id).sort()).toEqual(["1", "2"]);
  });

  test("age alone never makes a record a cleanup candidate", () => {
    const groups = findCleanupDuplicateGroups([
      item("1", "몇 달 뒤에도 기억하고 싶은 생각", {
        created_at: "2025-01-01T00:00:00.000Z",
      }),
      item("2", "최근 기록"),
    ]);
    expect(groups).toEqual([]);
  });

  test("short or conversational notes are not cleanup candidates merely for being short", () => {
    const groups = findCleanupDuplicateGroups([
      item("1", "응"),
      item("2", "ㅋㅋ"),
      item("3", "hi"),
      item("4", "뭐야"),
    ]);
    expect(groups).toEqual([]);
  });

  test("scheduled and unresolved ambiguous captures are excluded", () => {
    const groups = findCleanupDuplicateGroups([
      item("1", "치과", {
        temporal_state: "exact_datetime",
        start_time: "2026-09-01T08:00:00.000Z",
        end_time: "2026-09-01T09:00:00.000Z",
        structured_at: "2026-08-30T12:00:00.000Z",
      }),
      item("2", "치과", {
        temporal_state: "exact_datetime",
        start_time: "2026-09-01T08:00:00.000Z",
        end_time: "2026-09-01T09:00:00.000Z",
        structured_at: "2026-08-30T12:00:00.000Z",
      }),
      item("3", "내일 3시 병원", {
        temporal_state: "ambiguous",
        clarification_state: "pending",
      }),
      item("4", "내일 3시 병원", {
        temporal_state: "ambiguous",
        clarification_state: "pending",
      }),
    ]);
    expect(groups).toEqual([]);
  });

  test("image captures are excluded even when text matches", () => {
    const groups = findCleanupDuplicateGroups([
      item("1", "영수증", { images: ["image-a"] }),
      item("2", "영수증", { images: ["image-a"] }),
    ]);
    expect(groups).toEqual([]);
  });

  test("similar but non-identical notes are never merged into a candidate", () => {
    const groups = findCleanupDuplicateGroups([
      item("1", "엄마한테 전화"),
      item("2", "엄마한테 저녁에 전화"),
      item("3", "엄마 전화하기"),
    ]);
    expect(groups).toEqual([]);
  });

  test("candidate selection never mutates the input records", () => {
    const items = [item("1", "duplicate"), item("2", "duplicate")];
    const before = JSON.stringify(items);
    findCleanupDuplicateGroups(items);
    expect(JSON.stringify(items)).toBe(before);
  });
});
