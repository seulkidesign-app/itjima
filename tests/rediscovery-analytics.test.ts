import { beforeEach, describe, expect, test } from "vitest";
import type { RediscoveryPick } from "../src/lib/rediscoveryPick";
import { buildRediscoveryAnalyticsContext } from "../src/lib/rediscoveryAnalytics";

const NOW = Date.parse("2026-09-02T00:00:00.000Z");

function makePick(overrides: Partial<RediscoveryPick> = {}): RediscoveryPick {
  return {
    memory: {
      id: "secret-memory-id",
      text: "민감한 원문 내용",
      raw_text: "더 민감한 raw 내용",
      images: [],
      created_at: "2026-08-08T00:00:00.000Z",
    },
    ageKo: "25일 전",
    ageEn: "25 days ago",
    nudgeKo: "오늘 다시 보면 좋을 것 같아요.",
    nudgeEn: "Worth another quiet look today.",
    ...overrides,
  };
}

describe("Rediscovery UT analytics", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("never exposes record identity or user-entered content", () => {
    const ctx = buildRediscoveryAnalyticsContext(makePick(), NOW);
    const payload = JSON.stringify(ctx);

    expect(Object.keys(ctx).sort()).toEqual(
      [
        "age_bucket",
        "has_related_schedule",
        "reason",
        "repeat_visit",
        "visit_bucket",
      ].sort(),
    );
    expect(payload).not.toContain("secret-memory-id");
    expect(payload).not.toContain("민감한 원문 내용");
    expect(payload).not.toContain("더 민감한 raw 내용");
    expect(ctx.reason).toBe("long_unvisited");
    expect(ctx.age_bucket).toBe("21_59d");
    expect(ctx.visit_bucket).toBe("0");
  });

  test("records repeat visits only as a coarse bucket", () => {
    localStorage.setItem(
      "itjima.guest.archive.visits",
      JSON.stringify({ "secret-memory-id": 3 }),
    );

    const ctx = buildRediscoveryAnalyticsContext(makePick(), NOW);
    expect(ctx.visit_bucket).toBe("2_plus");
    expect(ctx.repeat_visit).toBe(true);
    expect(ctx.reason).toBe("quiet_revisit");
  });

  test("classifies an upcoming linked schedule without sending its text", () => {
    const pick = makePick({
      relatedSchedule: {
        id: "schedule-secret-id",
        text: "비밀 병원 일정",
        raw_text: "원문 비밀 병원 일정",
        start_time: "2026-09-05T00:00:00.000Z",
        end_time: "2026-09-05T01:00:00.000Z",
        alarm: false,
        created_at: "2026-08-08T00:00:00.000Z",
        status: "active",
      },
    });

    const ctx = buildRediscoveryAnalyticsContext(pick, NOW);
    expect(ctx.reason).toBe("upcoming_schedule");
    expect(ctx.has_related_schedule).toBe(true);
    expect(JSON.stringify(ctx)).not.toContain("비밀 병원 일정");
    expect(JSON.stringify(ctx)).not.toContain("schedule-secret-id");
  });
});
