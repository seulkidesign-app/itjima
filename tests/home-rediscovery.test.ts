import { describe, expect, test } from "vitest";
import {
  HOME_REDISCOVERY_KEEP_DAYS,
  selectHomeRediscoveryCandidate,
  type HomeRediscoveryState,
} from "@/lib/homeRediscovery";
import type { InboxItem } from "@/lib/store";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-30T12:00:00.000Z").getTime();

function item(
  id: string,
  ageDays: number,
  patch: Partial<InboxItem> = {},
): InboxItem {
  return {
    id,
    text: `record ${id}`,
    images: [],
    created_at: new Date(NOW - ageDays * DAY).toISOString(),
    status: "active",
    temporal_state: "no_time",
    ...patch,
  };
}

const emptyState: HomeRediscoveryState = { items: {} };

describe("P1 Home rediscovery contract", () => {
  test("does not duplicate any of the three records already visible on Home", () => {
    const items = [item("old", 2.9), item("a", 2), item("b", 1), item("c", 0.5)];
    expect(selectHomeRediscoveryCandidate(items, emptyState, NOW)).toBeNull();
  });

  test("resurfaces one older active record after three days", () => {
    const items = [item("old", 4), item("a", 2), item("b", 1), item("c", 0.5)];
    const candidate = selectHomeRediscoveryCandidate(items, emptyState, NOW);
    expect(candidate?.item.id).toBe("old");
    expect(candidate?.reason).toBe("age");
    expect(candidate?.ageDays).toBe(4);
  });

  test("chat volume can resurface a two-day-old record after six newer records", () => {
    const items = [
      item("old", 2.5),
      item("n1", 1.9),
      item("n2", 1.7),
      item("n3", 1.5),
      item("n4", 1.2),
      item("n5", 0.9),
      item("n6", 0.4),
    ];
    const candidate = selectHomeRediscoveryCandidate(items, emptyState, NOW);
    expect(candidate?.item.id).toBe("old");
    expect(candidate?.reason).toBe("volume");
    expect(candidate?.newerCount).toBe(6);
  });

  test("never resurfaces an already structured schedule or unresolved ambiguity", () => {
    const items = [
      item("scheduled", 8, {
        temporal_state: "exact_datetime",
        start_time: "2026-09-01T08:00:00.000Z",
        end_time: "2026-09-01T09:00:00.000Z",
        structured_at: "2026-08-22T12:00:00.000Z",
      }),
      item("ambiguous", 7, {
        temporal_state: "ambiguous",
        clarification_state: "pending",
      }),
      item("a", 2),
      item("b", 1),
      item("c", 0.5),
    ];
    expect(selectHomeRediscoveryCandidate(items, emptyState, NOW)).toBeNull();
  });

  test("shows at most one rediscovery per 24 hours", () => {
    const state: HomeRediscoveryState = {
      lastPresentedAt: NOW - 3 * 60 * 60 * 1000,
      items: {},
    };
    const items = [item("old", 10), item("a", 2), item("b", 1), item("c", 0.5)];
    expect(selectHomeRediscoveryCandidate(items, state, NOW)).toBeNull();
  });

  test("a passively shown record rests for three days before it can return", () => {
    const state: HomeRediscoveryState = {
      items: {
        old: { lastPresentedAt: NOW - DAY },
      },
    };
    const items = [item("old", 10), item("a", 2), item("b", 1), item("c", 0.5)];
    expect(selectHomeRediscoveryCandidate(items, state, NOW)).toBeNull();
  });

  test("Keep here/open snooze contract is seven days", () => {
    expect(HOME_REDISCOVERY_KEEP_DAYS).toBe(7);
    const state: HomeRediscoveryState = {
      items: {
        old: { snoozedUntil: NOW + HOME_REDISCOVERY_KEEP_DAYS * DAY },
      },
    };
    const items = [item("old", 10), item("a", 2), item("b", 1), item("c", 0.5)];
    expect(selectHomeRediscoveryCandidate(items, state, NOW)).toBeNull();
  });
});
