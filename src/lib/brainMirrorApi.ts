import {
  mockBrainMirror,
  parseBrainMirrorResult,
  type BrainMirrorResult,
} from "@/lib/brainMirror";

/**
 * Calls POST /api/brain-mirror when deployed.
 * Falls back to local mock so Magic Moment UX is testable without API keys.
 */
export async function fetchBrainMirror(text: string): Promise<BrainMirrorResult | null> {
  try {
    const res = await fetch("/api/brain-mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      const data = await res.json();
      const parsed = parseBrainMirrorResult(data);
      if (parsed) return parsed;
    }
  } catch {
    // fall through to mock
  }

  return mockBrainMirror(text);
}
