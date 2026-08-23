import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeScheduleInputForTrust,
  scheduleTrustIssue,
} from "@/lib/nlTrust";
import { buildNaturalScheduleDraft } from "@/lib/naturalScheduleDraft";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import type { InboxItem } from "@/lib/store";

function thought(text: string): InboxItem {
  return {
    id: "trust-thought",
    text,
    images: [],
    created_at: new Date().toISOString(),
    status: "active",
  };
}

describe("AI trust floor", () => {
  const now = new Date("2026-08-23T10:00:00+09:00");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes Korean dayparts before parsing the clock", () => {
    expect(normalizeScheduleInputForTrust("내일 저녁 7시 치과")).toBe(
      "내일 오후 7시 치과",
    );
    expect(normalizeScheduleInputForTrust("내일 밤 10시 약 먹기")).toBe(
      "내일 오후 10시 약 먹기",
    );
    expect(normalizeScheduleInputForTrust("내일 새벽 2시 공항")).toBe(
      "내일 오전 2시 공항",
    );
    expect(normalizeScheduleInputForTrust("내일 밤 1시 귀가")).toBe(
      "내일 오전 1시 귀가",
    );
  });

  it("parses contextual daypart clocks to the intended hour", () => {
    expect(buildNaturalScheduleDraft(thought("내일 저녁 7시 치과")).start.getHours()).toBe(19);
    expect(buildNaturalScheduleDraft(thought("내일 밤 10시 약 먹기")).start.getHours()).toBe(22);
    expect(buildNaturalScheduleDraft(thought("내일 새벽 2시 공항")).start.getHours()).toBe(2);
  });

  it("removes normalized daypart/time words from the saved title", () => {
    expect(buildNaturalScheduleDraft(thought("내일 저녁 7시 치과")).text).toBe("치과");
    expect(buildNaturalScheduleDraft(thought("내일 새벽 2시 공항")).text).toBe("공항");
  });

  it("understands common compound relative offsets", () => {
    const ninety = buildNaturalScheduleDraft(thought("한 시간 반 뒤 엄마한테 전화"));
    expect(ninety.start.getTime()).toBe(now.getTime() + 90 * 60_000);
    expect(ninety.text).toBe("엄마한테 전화");

    const twoThirty = buildNaturalScheduleDraft(thought("2시간 30분 후 출발"));
    expect(twoThirty.start.getTime()).toBe(now.getTime() + 150 * 60_000);
    expect(twoThirty.text).toBe("출발");
  });

  it("blocks broad dayparts instead of inventing an exact hour", () => {
    expect(scheduleTrustIssue("내일 저녁에 치과", now)).toBe("broad_daypart");
    const decision = evaluateTimedAutoCommit("내일 저녁에 치과", "ko", now);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("broad_daypart");
  });

  it("blocks impossible dates rather than normalizing them", () => {
    expect(scheduleTrustIssue("2월 30일 오후 3시 치과", now)).toBe(
      "invalid_datetime",
    );
    expect(scheduleTrustIssue("13월 2일 오후 3시 치과", now)).toBe(
      "invalid_datetime",
    );
  });

  it("blocks impossible clocks rather than clamping or rolling them", () => {
    expect(scheduleTrustIssue("내일 오후 25시 치과", now)).toBe(
      "invalid_datetime",
    );
    expect(scheduleTrustIssue("내일 오후 3시 75분 치과", now)).toBe(
      "invalid_datetime",
    );
    expect(scheduleTrustIssue("내일 27:10 치과", now)).toBe(
      "invalid_datetime",
    );
  });

  it("allows clear contextual clocks to auto-commit after normalization", () => {
    const decision = evaluateTimedAutoCommit("내일 저녁 7시 치과", "ko", now);
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.draft.start.getHours()).toBe(19);
      expect(decision.draft.text).toBe("치과");
    }
  });
});
