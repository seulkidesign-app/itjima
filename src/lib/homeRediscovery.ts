import { isStructuredTimedRecord } from "@/lib/recordTemporal";
import type { InboxItem } from "@/lib/store";

const DAY_MS = 24 * 60 * 60 * 1000;
const GLOBAL_PRESENT_COOLDOWN_MS = DAY_MS;
const PASSIVE_ITEM_COOLDOWN_MS = 3 * DAY_MS;
export const HOME_REDISCOVERY_KEEP_DAYS = 7;

export type HomeRediscoveryReason = "age" | "volume";

export type HomeRediscoveryCandidate = {
  item: InboxItem;
  ageDays: number;
  newerCount: number;
  reason: HomeRediscoveryReason;
};

export type HomeRediscoveryItemState = {
  lastPresentedAt?: number;
  snoozedUntil?: number;
};

export type HomeRediscoveryState = {
  lastPresentedAt?: number;
  items: Record<string, HomeRediscoveryItemState>;
};

export type HomeRediscoverySelectionOptions = {
  /** Exact records already rendered in Home's recent-record section. */
  visibleItemIds?: ReadonlySet<string>;
  /** Records currently rendered as clarification/recovery instead of quiet notes. */
  excludedItemIds?: ReadonlySet<string>;
};

const EMPTY_STATE: HomeRediscoveryState = { items: {} };
const GUEST = "guest";

function storageKey(userId: string | null) {
  return `itjima.${userId ?? GUEST}.rediscovery.home`;
}

function parseTime(iso: string): number | null {
  const time = +new Date(iso);
  return Number.isFinite(time) ? time : null;
}

function isEligibleRecord(item: InboxItem): boolean {
  if (item.status && item.status !== "active") return false;
  if (isStructuredTimedRecord(item)) return false;
  if (item.clarification_state === "pending") return false;
  if (item.temporal_state === "ambiguous") return false;
  return Boolean(item.text.trim());
}

export function readHomeRediscoveryState(
  userId: string | null,
): HomeRediscoveryState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(storageKey(userId)) || "null",
    ) as Partial<HomeRediscoveryState> | null;
    if (!raw || typeof raw !== "object") return EMPTY_STATE;
    return {
      lastPresentedAt:
        typeof raw.lastPresentedAt === "number" ? raw.lastPresentedAt : undefined,
      items:
        raw.items && typeof raw.items === "object"
          ? (raw.items as Record<string, HomeRediscoveryItemState>)
          : {},
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeHomeRediscoveryState(
  userId: string | null,
  state: HomeRediscoveryState,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function markHomeRediscoveryPresented(
  userId: string | null,
  itemId: string,
  now = Date.now(),
) {
  const state = readHomeRediscoveryState(userId);
  writeHomeRediscoveryState(userId, {
    ...state,
    lastPresentedAt: now,
    items: {
      ...state.items,
      [itemId]: {
        ...state.items[itemId],
        lastPresentedAt: now,
      },
    },
  });
}

export function keepHomeRediscoveryQuiet(
  userId: string | null,
  itemId: string,
  now = Date.now(),
) {
  const state = readHomeRediscoveryState(userId);
  writeHomeRediscoveryState(userId, {
    ...state,
    items: {
      ...state.items,
      [itemId]: {
        ...state.items[itemId],
        snoozedUntil: now + HOME_REDISCOVERY_KEEP_DAYS * DAY_MS,
      },
    },
  });
}

/**
 * P1 contract:
 * - Home resurfaces existing active, non-scheduled records only.
 * - Never duplicate records Home already renders as recent/clarification UI.
 * - Normal trigger: at least 3 days old.
 * - High-volume trigger: at least 2 days old with 6+ newer records.
 * - At most one rediscovery per 24h and the same passively shown item rests 3 days.
 * - “Keep here” / opening the record can snooze that item for 7 days.
 */
export function selectHomeRediscoveryCandidate(
  items: InboxItem[],
  state: HomeRediscoveryState = EMPTY_STATE,
  now = Date.now(),
  options: HomeRediscoverySelectionOptions = {},
): HomeRediscoveryCandidate | null {
  if (
    state.lastPresentedAt &&
    now - state.lastPresentedAt < GLOBAL_PRESENT_COOLDOWN_MS
  ) {
    return null;
  }

  const excludedItemIds = options.excludedItemIds ?? new Set<string>();
  const eligible = items
    .filter((item) => !excludedItemIds.has(item.id) && isEligibleRecord(item))
    .map((item) => ({ item, created: parseTime(item.created_at) }))
    .filter(
      (row): row is { item: InboxItem; created: number } => row.created !== null,
    )
    .sort((a, b) => b.created - a.created);

  const alreadyVisible =
    options.visibleItemIds ??
    new Set(eligible.slice(0, 3).map((row) => row.item.id));

  if (eligible.every((row) => alreadyVisible.has(row.item.id))) return null;

  const candidates: HomeRediscoveryCandidate[] = [];

  for (const { item, created } of eligible) {
    if (alreadyVisible.has(item.id)) continue;

    const itemState = state.items[item.id];
    if (itemState?.snoozedUntil && itemState.snoozedUntil > now) continue;
    if (
      itemState?.lastPresentedAt &&
      now - itemState.lastPresentedAt < PASSIVE_ITEM_COOLDOWN_MS
    ) {
      continue;
    }

    const ageMs = Math.max(0, now - created);
    const ageDays = Math.floor(ageMs / DAY_MS);
    const newerCount = eligible.filter((row) => row.created > created).length;
    const ageEligible = ageMs >= 3 * DAY_MS;
    const volumeEligible = ageMs >= 2 * DAY_MS && newerCount >= 6;
    if (!ageEligible && !volumeEligible) continue;

    candidates.push({
      item,
      ageDays,
      newerCount,
      reason: ageEligible ? "age" : "volume",
    });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    if (b.newerCount !== a.newerCount) return b.newerCount - a.newerCount;
    return +new Date(a.item.created_at) - +new Date(b.item.created_at);
  });

  return candidates[0];
}
