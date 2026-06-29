import { parseBrainMirrorResult, type BrainMirrorResult } from "@/lib/brainMirror";

/** Calls Vercel serverless function. Returns null on any failure (silent UX). */
export async function fetchBrainMirror(text: string): Promise<BrainMirrorResult | null> {
  try {
    const res = await fetch("/api/brain-mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return parseBrainMirrorResult(data);
  } catch {
    return null;
  }
}
