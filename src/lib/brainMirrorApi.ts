import {
  mockBrainMirror,
  parseBrainMirrorResult,
  type BrainMirrorResult,
} from "@/lib/brainMirror";

/**
 * Calls POST /api/brain-mirror when deployed.
 * Production: validator rejection (null) or API failure → silent null.
 * Dev: falls back to local mock when API route is unavailable.
 */
export async function fetchBrainMirror(
  text: string,
  signal?: AbortSignal,
): Promise<BrainMirrorResult | null> {
  try {
    const res = await fetch("/api/brain-mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });

    if (res.ok) {
      const data = await res.json();
      if (data === null) return null;
      const parsed = parseBrainMirrorResult(data);
      if (parsed?.items.length) return parsed;
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    // fall through to mock (dev only)
  }

  if (import.meta.env.PROD) return null;
  return mockBrainMirror(text);
}
