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

const inflight = new Map<string, Promise<BrainMirrorFetchOutcome>>();

function inflightKey(text: string, mode: "classify" | "organize", force: boolean) {
  return `${mode}:${force ? "1" : "0"}:${text}`;
}

function parseApiPayload(
  text: string,
  data: unknown,
  mode: "classify" | "organize",
): BrainMirrorResult | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;

  if (mode === "classify") {
    const full = parseBrainMirrorResult(data);
    if (full?.items.length) return full;
    return expandClassifyPayload(text, raw);
  }

  return parseBrainMirrorResult(data);
}

async function fetchBrainMirrorInner(
  text: string,
  options: BrainMirrorFetchOptions = {},
): Promise<BrainMirrorFetchOutcome> {
  const { signal, mode = "classify", force = false } = options;
  const trimmed = text.trim();
  if (trimmed.length < 2) return { status: "skipped" };

  if (!force && mode === "classify") {
    const resolution = resolveIntelligence(trimmed);
    if (resolution.kind === "local" || resolution.kind === "cache") {
      if (resolution.result?.items.length) {
        if (resolution.kind === "local") {
          setCachedAiResult(trimmed, resolution.result, "local");
        }
        return {
          status: "ok",
          result: resolution.result,
          source: resolution.kind,
        };
      }
    }
    if (
      resolution.kind === "skip" ||
      resolution.kind === "needs_user_ai" ||
      resolution.kind === "cache"
    ) {
      return { status: "skipped" };
    }
    if (!shouldCallFallbackAi(trimmed)) {
      setCachedSkip(trimmed);
      return { status: "skipped" };
    }
    if (hasBeenAnalyzed(trimmed)) {
      const cached = getCachedAiResult(trimmed);
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

  if (!force && mode === "classify") {
    const cached = getCachedAiResult(trimmed);
    if (cached?.items.length) {
      return {
        status: "ok",
        result: finalizeBrainMirror(cached, null),
        source: "cache",
      };
    }
  }

  try {
    const res = await fetch("/api/brain-mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, mode }),
      signal,
    });

    if (res.ok) {
      const data = await res.json();
      if (data === null) {
        if (mode === "classify") setCachedSkip(trimmed);
        return { status: "empty" };
      }
      const parsed = parseApiPayload(trimmed, data, mode);
      if (!parsed?.items.length) {
        if (mode === "classify") {
          const local = classifyLocally(trimmed);
          if (local?.result?.items.length) {
            setCachedAiResult(trimmed, local.result, "local");
            return { status: "ok", result: local.result, source: "local" };
          }
          setCachedSkip(trimmed);
        }
        return { status: "empty" };
      }
      setCachedAiResult(
        trimmed,
        parsed,
        mode === "organize" ? "organize" : "classify",
      );
      return {
        status: "ok",
        result: parsed,
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
      setCachedAiResult(trimmed, mock, "organize");
      return { status: "ok", result: mock, source: "organize" };
    }
    return { status: "empty" };
  }

  const local = classifyLocally(trimmed);
  if (local?.result?.items.length) {
    setCachedAiResult(trimmed, local.result, "local");
    return { status: "ok", result: local.result, source: "local" };
  }

  if (import.meta.env.DEV) {
    const mock = mockBrainMirror(trimmed);
    if (mock?.items.length) {
      setCachedAiResult(trimmed, mock, "classify");
      return { status: "ok", result: mock, source: "classify" };
    }
  }

  setCachedSkip(trimmed);
  return { status: "empty" };
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
