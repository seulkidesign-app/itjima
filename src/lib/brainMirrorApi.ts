import {
  mockBrainMirror,
  parseBrainMirrorResult,
  type BrainMirrorResult,
} from "@/lib/brainMirror";

export type BrainMirrorFetchOutcome =
  | { status: "ok"; result: BrainMirrorResult }
  | { status: "empty" }
  | { status: "unavailable" };

/**
 * Calls POST /api/brain-mirror when deployed.
 * Production API/network failure → unavailable (caller shows feedback).
 * Dev: falls back to local mock when API route is unavailable.
 */
export async function fetchBrainMirror(
  text: string,
  signal?: AbortSignal,
): Promise<BrainMirrorFetchOutcome> {
  try {
    const res = await fetch("/api/brain-mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });

    if (res.ok) {
      const data = await res.json();
      if (data === null) return { status: "empty" };
      const parsed = parseBrainMirrorResult(data);
      if (parsed?.items.length) return { status: "ok", result: parsed };
      return { status: "empty" };
    }

    if (import.meta.env.PROD) return { status: "unavailable" };
  } catch (err) {
    if (signal?.aborted) throw err;
    if (import.meta.env.PROD) return { status: "unavailable" };
  }

  const mock = mockBrainMirror(text);
  if (mock?.items.length) return { status: "ok", result: mock };
  return { status: "empty" };
}
