import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  markRediscoverySessionShown,
  pickRediscoveryCandidate,
  type RediscoveryMemory,
} from "../src/lib/rediscoveryPick";

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
});
