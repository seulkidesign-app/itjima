export const FEATURES = {
  BRAIN_MIRROR: false,
  REDISCOVERY: false,
  CLEANUP: false,
  INLINE_PROMISE: true,
  PASTE_SPLIT: false,
  /** Archive: 생각 지도 / Thought map layout */
  ARCHIVE_THOUGHT_MAP: false,
  /** Archive: 다시 만나기 / Revisit link */
  ARCHIVE_REVISIT: false,
  /** Archive: 이어지는 생각 / Threads that connect */
  ARCHIVE_CONTINUING_THOUGHTS: false,
  /** Archive: 자주 떠오르는 생각 / thinking insights */
  ARCHIVE_FREQUENT_THOUGHTS: false,
  /** Archive: memory journey chapters */
  ARCHIVE_JOURNEY: false,
  /** Archive: 가까운 순 sort toggle */
  ARCHIVE_NEARBY_SORT: false,
  /** Archive: AI / keyword grouping — disabled for v1 */
  ARCHIVE_AI_GROUPING: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

/**
 * v1 release boundary.
 * Experimental AI and archive surfaces remain unavailable even when an old E2E
 * or localStorage override exists in the browser. Deterministic schedule/task
 * understanding is allowed as a core v1 experience.
 */
const V1_LOCKED_OFF = new Set<FeatureKey>([
  "BRAIN_MIRROR",
  "ARCHIVE_AI_GROUPING",
]);

function readOverride(key: FeatureKey): boolean | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem("itjima.__feature_overrides__");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<Record<FeatureKey, boolean>>;
    return parsed[key];
  } catch {
    return undefined;
  }
}

/** Runtime feature gate — experimental surfaces stay locked off for v1. */
export function featureEnabled(key: FeatureKey): boolean {
  if (V1_LOCKED_OFF.has(key)) return false;
  const override = readOverride(key);
  if (override !== undefined) return override;
  return FEATURES[key];
}
