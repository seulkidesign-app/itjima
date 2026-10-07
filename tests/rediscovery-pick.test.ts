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

function memory(id: string, ageMs: number): RediscoveryMemory {
  return {
    id,
    text: id,
    images: [],
    created_at: new Date(NOW - ageMs).toISOString(),
    rediscovery_source: "record",
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

  it("marks an old rarely visited record as long unvisited", () => {
    const candidate = memory("old-note", 30 * DAY);
    expect(pickRediscoveryCandidate([candidate], [])?.reason).toBe("long_unvisited");
  });
});
