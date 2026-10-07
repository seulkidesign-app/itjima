import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dismissRediscovery,
  markRediscoverySessionShown,
  pickRediscoveryCandidate,
  snoozeRediscovery,
  type RediscoveryMemory,
} from "../src/lib/rediscoveryPick";
import type { ScheduleItem } from "../src/lib/store";

const NOW = Date.parse("2026-09-05T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function memory(
  id: string,
  ageMs: number,
  text = id,
  source: "record" | "archive" = "record",
): RediscoveryMemory {
  return {
    id,
    text,
    images: [],
    created_at: new Date(NOW - ageMs).toISOString(),
    rediscovery_source: source,
  };
}

function schedule(sourceId: string, startsInMs: number): ScheduleItem {
  return {
    id: `schedule-${sourceId}`,
    text: sourceId,
    source_id: sourceId,
    start_time: new Date(NOW + startsInMs).toISOString(),
    end_time: new Date(NOW + startsInMs + HOUR).toISOString(),
    status: "active",
    alarm: false,
  } as ScheduleItem;
}

describe("rediscovery cadence", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first rediscovery after 8 hours, then requires 3 days", () => {
    expect(pickRediscoveryCandidate([memory("too-early", 7 * HOUR)], [])).toBeNull();

    const first = pickRediscoveryCandidate([memory("first", 9 * HOUR)], []);
    expect(first?.key).toBe("first");

    markRediscoverySessionShown(first?.key);
    sessionStorage.clear();

    expect(pickRediscoveryCandidate([memory("second-too-early", 12 * HOUR)], [])).toBeNull();

    const later = pickRediscoveryCandidate([memory("second-ready", 4 * DAY)], []);
    expect(later?.key).toBe("second-ready");
  });

  it("does not show the same record twice in one session", () => {
    const candidate = memory("session-record", 9 * HOUR);
    expect(pickRediscoveryCandidate([candidate], [])?.key).toBe("session-record");

    markRediscoverySessionShown("session-record");

    expect(pickRediscoveryCandidate([candidate], [])).toBeNull();
  });

  it("respects Later until the snooze expires", () => {
    const candidate = memory("later-record", 10 * DAY);
    snoozeRediscovery("later-record", NOW + 3 * DAY);

    expect(pickRediscoveryCandidate([candidate], [])).toBeNull();

    vi.setSystemTime(NOW + 3 * DAY + 1);
    expect(pickRediscoveryCandidate([candidate], [])?.key).toBe("later-record");
  });

  it("respects Hide across future sessions", () => {
    const candidate = memory("hidden-record", 10 * DAY);
    dismissRediscovery("hidden-record");

    expect(pickRediscoveryCandidate([candidate], [])).toBeNull();

    sessionStorage.clear();
    vi.setSystemTime(NOW + 30 * DAY);
    expect(pickRediscoveryCandidate([candidate], [])).toBeNull();
  });

  it("calls a linked schedule upcoming only when it is within 7 days", () => {
    const candidate = memory("appointment-note", 10 * DAY);

    const near = pickRediscoveryCandidate(
      [candidate],
      [schedule("appointment-note", 3 * DAY)],
    );
    expect(near?.reason).toBe("upcoming_schedule");

    const far = pickRediscoveryCandidate(
      [candidate],
      [schedule("appointment-note", 21 * DAY)],
    );
    expect(far?.reason).toBe("quiet_revisit");
  });

  it("always ranks an upcoming linked schedule above contextual similarity", () => {
    const scheduled = memory("appointment-note", 8 * DAY, "치과 예약 확인하기");
    const contextual = memory(
      "portfolio-old",
      90 * DAY,
      "포트폴리오 결과 화면 수정하기",
    );
    const recent = memory(
      "portfolio-now",
      2 * HOUR,
      "포트폴리오 결과 화면 다시 보기",
    );

    const pick = pickRediscoveryCandidate(
      [scheduled, contextual, recent],
      [schedule("appointment-note", 1 * DAY)],
    );

    expect(pick?.key).toBe("appointment-note");
    expect(pick?.reason).toBe("upcoming_schedule");
  });

  it("marks an old rarely visited record as long unvisited", () => {
    const candidate = memory("old-note", 30 * DAY);
    expect(pickRediscoveryCandidate([candidate], [])?.reason).toBe("long_unvisited");
  });

  it("prefers an older record that matches a very recent capture", () => {
    const related = memory(
      "portfolio-old",
      10 * DAY,
      "포트폴리오 첫 장에 결과 화면 먼저 보여주기",
    );
    const recentContext = memory(
      "portfolio-now",
      2 * HOUR,
      "포트폴리오 결과 화면 다시 수정하기",
    );
    const unrelatedOlder = memory(
      "groceries-old",
      25 * DAY,
      "마트에서 장보기 우유 계란",
    );

    const pick = pickRediscoveryCandidate(
      [related, recentContext, unrelatedOlder],
      [],
    );

    expect(pick?.key).toBe("portfolio-old");
    expect(pick?.reason).toBe("related_capture");
    expect(pick?.relatedContext?.id).toBe("portfolio-now");
  });

  it("does not invent context from a single weak shared word", () => {
    const old = memory("weak-old", 10 * DAY, "회사 끝나고 책 읽기");
    const recent = memory("weak-now", 2 * HOUR, "회사 점심 메뉴 확인");

    const pick = pickRediscoveryCandidate([old, recent], []);

    expect(pick?.reason).not.toBe("related_capture");
  });

  it("does not use a recent archive item as current context", () => {
    const old = memory(
      "portfolio-old",
      10 * DAY,
      "포트폴리오 결과 화면 수정하기",
    );
    const recentArchive = memory(
      "portfolio-archive",
      2 * HOUR,
      "포트폴리오 결과 화면 다시 보기",
      "archive",
    );

    const pick = pickRediscoveryCandidate([old, recentArchive], []);

    expect(pick?.reason).not.toBe("related_capture");
  });
});
