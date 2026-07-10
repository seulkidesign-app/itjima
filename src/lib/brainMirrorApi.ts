import {
  mockBrainMirror,
  parseBrainMirrorResult,
  finalizeBrainMirror,
  type BrainMirrorResult,
} from "@/lib/brainMirror";
import {
  classifyLocally,
  resolveIntelligence,
  shouldCallFallbackAi,
  expandClassifyPayload,
} from "@/lib/localClassifier";
import {
  getCachedAiResult,
  setCachedAiResult,
  setCachedSkip,
  hasBeenAnalyzed,
} from "@/lib/aiCache";
import {
  aiCacheKeyText,
  isRelativeDateReference,
  hasScheduleTimeIntent,
  type MirrorTimingExtra,
} from "@/lib/dateDetect";

export type BrainMirrorFetchOutcome =
  | {
      status: "ok";
      result: BrainMirrorResult;
      source: "local" | "cache" | "classify" | "organize";
    }
  | { status: "empty" }
  | { status: "unavailable" }
  | { status: "skipped" };

export type BrainMirrorFetchOptions = {
  signal?: AbortSignal;
  /** Layer 3 — user tapped "AI Organize" */
  mode?: "classify" | "organize";
  /** Bypass cache read (still writes result to cache) */
  force?: boolean;
};

const CLASSIFY_TIMEOUT_MS = 2500;

const inflight = new Map<string, Promise<BrainMirrorFetchOutcome>>();

function inflightKey(text: string, mode: "classify" | "organize", force: boolean) {
  return `${mode}:${force ? "1" : "0"}:${text}`;
}

function classifyCacheKey(text: string): string {
  return aiCacheKeyText(text);
}

function parseTimingFromRaw(
  raw: Record<string, unknown>,
): MirrorTimingExtra | null {
  const suggestedStart =
    typeof raw.suggestedStart === "string" ? raw.suggestedStart.trim() : "";
  const timingReason =
    typeof raw.reason === "string"
      ? raw.reason.trim()
      : typeof raw.timingReason === "string"
        ? raw.timingReason.trim()
        : "";
  const confRaw =
    typeof raw.confidence === "string"
      ? raw.confidence.trim().toLowerCase()
      : typeof raw.timingConfidence === "string"
        ? raw.timingConfidence.trim().toLowerCase()
        : "";
  const timingConfidence: MirrorTimingExtra["timingConfidence"] =
    confRaw === "high" || confRaw === "low" ? confRaw : undefined;

  if (!suggestedStart && !timingReason && !timingConfidence) return null;

  return {
    ...(suggestedStart ? { suggestedStart } : {}),
    ...(timingReason ? { timingReason } : {}),
    ...(timingConfidence ? { timingConfidence } : {}),
  };
}

function hasHighConfidenceTiming(
  result: BrainMirrorResult & MirrorTimingExtra,
): boolean {
  return (
    result.timingConfidence === "high" &&
    typeof result.suggestedStart === "string" &&
    result.suggestedStart.length > 0
  );
}

function mergeTiming(
  base: BrainMirrorResult,
  raw: Record<string, unknown>,
): BrainMirrorResult & MirrorTimingExtra {
  const timing = parseTimingFromRaw(raw);
  if (!timing) return base;
  return { ...base, ...timing };
}

function attachTiming(
  result: BrainMirrorResult,
  raw: Record<string, unknown>,
): BrainMirrorResult & MirrorTimingExtra {
  return mergeTiming(result, raw);
}

function stripTimingForCache(
  result: BrainMirrorResult & MirrorTimingExtra,
): BrainMirrorResult {
  const { suggestedStart, timingReason, timingConfidence, ...rest } =
    result as BrainMirrorResult & MirrorTimingExtra;
  void suggestedStart;
  void timingReason;
  void timingConfidence;
  return rest;
}

function parseApiPayload(
  text: string,
  data: unknown,
  mode: "classify" | "organize",
): (BrainMirrorResult & MirrorTimingExtra) | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;

  if (mode === "classify") {
    const full = parseBrainMirrorResult(data);
    if (full?.items.length) return attachTiming(full, raw);
    const expanded = expandClassifyPayload(text, raw);
    if (!expanded) return null;
    return attachTiming(expanded, raw);
  }

  const parsed = parseBrainMirrorResult(data);
  return parsed;
}

async function fetchBrainMirrorInner(
  text: string,
  options: BrainMirrorFetchOptions = {},
): Promise<BrainMirrorFetchOutcome> {
  const { signal, mode = "classify", force = false } = options;
  const trimmed = text.trim();
  if (trimmed.length < 2) return { status: "skipped" };

  const cacheKey = mode === "classify" ? classifyCacheKey(trimmed) : trimmed;
  const skipCacheForRelative =
    mode === "classify" && isRelativeDateReference(trimmed);
  const scheduleTimeIntent =
    mode === "classify" && hasScheduleTimeIntent(trimmed);
  let pendingLocal: BrainMirrorResult | null = null;

  if (!force && mode === "classify") {
    const resolution = resolveIntelligence(trimmed);
    if (resolution.kind === "local" || resolution.kind === "cache") {
      if (resolution.result?.items.length) {
        const timingExtra = readCachedTimingExtra(trimmed);
        const merged = timingExtra
          ? ({ ...resolution.result, ...timingExtra } as BrainMirrorResult &
              MirrorTimingExtra)
          : resolution.result;
        if (
          !scheduleTimeIntent ||
          hasHighConfidenceTiming(merged as BrainMirrorResult & MirrorTimingExtra)
        ) {
          if (resolution.kind === "local" && !skipCacheForRelative) {
            setCachedAiResult(cacheKey, resolution.result, "local");
          }
          return {
            status: "ok",
            result: merged,
            source: resolution.kind,
          };
        }
        if (resolution.kind === "local") {
          pendingLocal = resolution.result;
        }
      }
    }
    if (
      resolution.kind === "skip" ||
      resolution.kind === "needs_user_ai" ||
      resolution.kind === "cache"
    ) {
      return { status: "skipped" };
    }
    if (!shouldCallFallbackAi(trimmed) && !scheduleTimeIntent) {
      if (!skipCacheForRelative) setCachedSkip(cacheKey);
      return { status: "skipped" };
    }
    if (!skipCacheForRelative && hasBeenAnalyzed(cacheKey)) {
      const cached = getCachedAiResult(cacheKey);
      if (cached?.items.length) {
        return {
          status: "ok",
          result: finalizeBrainMirror(cached, null),
          source: "cache",
        };
      }
      return { status: "skipped" };
    }
  }

  if (!force && mode === "classify" && !skipCacheForRelative) {
    const cached = getCachedAiResult(cacheKey);
    if (cached?.items.length) {
      return {
        status: "ok",
        result: finalizeBrainMirror(cached, null),
        source: "cache",
      };
    }
  }

  try {
    const timeout =
      mode === "classify" && !signal
        ? AbortSignal.timeout(CLASSIFY_TIMEOUT_MS)
        : signal;

    const res = await fetch("/api/brain-mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, mode }),
      signal: timeout,
    });

    if (res.ok) {
      const data = await res.json();
      if (data === null) {
        if (mode === "classify" && !skipCacheForRelative) setCachedSkip(cacheKey);
        return { status: "empty" };
      }
      const parsed = parseApiPayload(trimmed, data, mode);
      if (!parsed?.items.length) {
        if (mode === "classify") {
          const local = classifyLocally(trimmed);
          if (local?.result?.items.length) {
            if (!skipCacheForRelative) {
              setCachedAiResult(cacheKey, local.result, "local");
            }
            return { status: "ok", result: local.result, source: "local" };
          }
          if (!skipCacheForRelative) setCachedSkip(cacheKey);
        }
        return { status: "empty" };
      }
      const result =
        pendingLocal && mode === "classify"
          ? mergeTiming(pendingLocal, data as Record<string, unknown>)
          : parsed;
      if (mode === "classify") {
        const toStore = skipCacheForRelative
          ? stripTimingForCache(result)
          : result;
        if (!skipCacheForRelative) {
          setCachedAiResult(cacheKey, toStore, "classify");
        }
      } else {
        setCachedAiResult(cacheKey, parsed, "organize");
      }
      return {
        status: "ok",
        result,
        source: mode === "organize" ? "organize" : "classify",
      };
    }

    if (import.meta.env.PROD) return { status: "unavailable" };
  } catch (err) {
    if (signal?.aborted) throw err;
    if (import.meta.env.PROD) return { status: "unavailable" };
  }

  if (mode === "organize") {
    const mock = mockBrainMirror(trimmed);
    if (mock?.items.length) {
      setCachedAiResult(cacheKey, mock, "organize");
      return { status: "ok", result: mock, source: "organize" };
    }
    return { status: "empty" };
  }

  const local = classifyLocally(trimmed);
  if (local?.result?.items.length) {
    if (!skipCacheForRelative) {
      setCachedAiResult(cacheKey, local.result, "local");
    }
    return { status: "ok", result: local.result, source: "local" };
  }

  if (import.meta.env.DEV) {
    const mock = mockBrainMirror(trimmed);
    if (mock?.items.length) {
      const enriched = attachTiming(mock, {
        suggestedStart: devSuggestedStart(trimmed),
        reason: devTimingReason(trimmed),
        confidence: devTimingConfidence(trimmed),
      });
      if (!skipCacheForRelative) {
        setCachedAiResult(cacheKey, enriched, "classify");
      }
      return { status: "ok", result: enriched, source: "classify" };
    }
  }

  if (!skipCacheForRelative) setCachedSkip(cacheKey);
  return { status: "empty" };
}

function devSuggestedStart(text: string): string {
  if (!/생일|birthday/i.test(text)) return "";
  const d = new Date();
  d.setDate(d.getDate() + 11);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

function devTimingReason(text: string): string {
  if (/생일|birthday/i.test(text)) {
    return "생일 2일 전, 여유롭게 준비할 수 있는 순간이에요.";
  }
  return "";
}

function devTimingConfidence(text: string): string {
  if (/생일|birthday/i.test(text)) return "high";
  return "low";
}

/** Read timing extras written alongside a cached classify result. */
export function readCachedTimingExtra(text: string): MirrorTimingExtra | null {
  if (isRelativeDateReference(text)) return null;
  const cached = getCachedAiResult(aiCacheKeyText(text));
  if (!cached) return null;
  return parseTimingFromRaw(cached as Record<string, unknown>);
}

/**
 * Three-layer intelligence:
 * 1. Local rules (free, instant) — default
 * 2. Fallback classify API (low confidence only)
 * 3. Organize API (user-initiated only)
 */
export async function fetchBrainMirror(
  text: string,
  options: BrainMirrorFetchOptions = {},
): Promise<BrainMirrorFetchOutcome> {
  const trimmed = text.trim();
  const key = inflightKey(trimmed, options.mode ?? "classify", options.force ?? false);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetchBrainMirrorInner(trimmed, options).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

/** Layer 3 — explicit user-initiated AI organize. */
export function fetchAiOrganize(
  text: string,
  signal?: AbortSignal,
): Promise<BrainMirrorFetchOutcome> {
  return fetchBrainMirror(text, { signal, mode: "organize", force: true });
}
