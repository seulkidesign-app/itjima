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
} from "@/lib/localClassifier";
import {
  getCachedAiResult,
  setCachedAiResult,
  hasCachedAiResult,
} from "@/lib/aiCache";

export type BrainMirrorFetchOutcome =
  | { status: "ok"; result: BrainMirrorResult; source: "local" | "cache" | "classify" | "organize" }
  | { status: "empty" }
  | { status: "unavailable" }
  | { status: "skipped" };

export type BrainMirrorFetchOptions = {
  signal?: AbortSignal;
  /** Layer 3 — user tapped "AI Organize" */
  mode?: "classify" | "organize";
  /** Bypass cache (still writes result to cache) */
  force?: boolean;
};

/**
 * Three-layer intelligence:
 * 1. Local rules (free, instant)
 * 2. Fallback classify API (low confidence only)
 * 3. Organize API (user-initiated only)
 */
export async function fetchBrainMirror(
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
        return {
          status: "ok",
          result: resolution.result,
          source: resolution.kind,
        };
      }
    }
    if (resolution.kind === "skip" || resolution.kind === "needs_user_ai") {
      return { status: "skipped" };
    }
    if (!shouldCallFallbackAi(trimmed)) {
      return { status: "skipped" };
    }
  }

  if (!force && mode === "classify" && hasCachedAiResult(trimmed)) {
    const cached = getCachedAiResult(trimmed)!;
    const parsed = finalizeBrainMirror(cached, null);
    if (parsed.items.length) {
      return { status: "ok", result: parsed, source: "cache" };
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
      if (data === null) return { status: "empty" };
      const parsed = parseBrainMirrorResult(data);
      if (!parsed?.items.length) {
        if (mode === "classify") {
          const local = classifyLocally(trimmed);
          if (local?.result?.items.length) {
            setCachedAiResult(trimmed, local.result, "local");
            return { status: "ok", result: local.result, source: "local" };
          }
        }
        return { status: "empty" };
      }
      setCachedAiResult(trimmed, parsed, mode === "organize" ? "organize" : "classify");
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

  const mock = mockBrainMirror(trimmed);
  if (mock?.items.length) {
    setCachedAiResult(trimmed, mock, "classify");
    return { status: "ok", result: mock, source: "classify" };
  }
  return { status: "empty" };
}

/** Layer 3 — explicit user-initiated AI organize. */
export function fetchAiOrganize(
  text: string,
  signal?: AbortSignal,
): Promise<BrainMirrorFetchOutcome> {
  return fetchBrainMirror(text, { signal, mode: "organize", force: true });
}
