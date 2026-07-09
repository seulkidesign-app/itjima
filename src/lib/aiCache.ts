import type { BrainMirrorCore } from "@/lib/brainMirror";

const CACHE_KEY = "itjima.ai.cache";
const MAX_ENTRIES = 200;

export type AiCacheSource = "local" | "classify" | "organize";

type CacheEntry = {
  hash: string;
  result: BrainMirrorCore;
  source: AiCacheSource;
  at: string;
};

type CacheStore = Record<string, CacheEntry>;

/** Normalize text before hashing so whitespace variants hit the same cache. */
export function normalizeForCache(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** Fast deterministic hash — avoids analyzing the same text twice. */
export function hashText(text: string): string {
  const s = normalizeForCache(text);
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function readStore(): CacheStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CacheStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: CacheStore) {
  if (typeof window === "undefined") return;
  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys
      .map((k) => ({ k, at: store[k].at }))
      .sort((a, b) => a.at.localeCompare(b.at));
    for (const { k } of sorted.slice(0, keys.length - MAX_ENTRIES)) {
      delete store[k];
    }
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(store));
}

export function getCachedAiResult(text: string): BrainMirrorCore | null {
  const hash = hashText(text);
  const entry = readStore()[hash];
  if (!entry?.result?.title) return null;
  if (!Array.isArray(entry.result.items)) return null;
  return entry.result;
}

export function setCachedAiResult(
  text: string,
  result: BrainMirrorCore,
  source: AiCacheSource,
) {
  const hash = hashText(text);
  const store = readStore();
  store[hash] = {
    hash,
    result,
    source,
    at: new Date().toISOString(),
  };
  writeStore(store);
}

export function hasCachedAiResult(text: string): boolean {
  return getCachedAiResult(text) !== null;
}
