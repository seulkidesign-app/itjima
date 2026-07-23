import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Haiku 4.5 — https://platform.claude.com/docs/en/about-claude/models/overview */
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

/** Layer 2 — minimal classify prompt (<150 tokens). JSON only. */
const CLASSIFY_PROMPT = `JSON only: {"category":"","title":"","suggestedDate":"","suggestedStart":"","reason":"","confidence":""}
category: schedule|shopping|reminder|task|list|note
title: max 18 chars from input
suggestedDate: date word from input or ""
suggestedStart: ISO8601 internal only if date in input, else ""
reason: calm Korean nudge only — NO dates, weekdays, or "N일 전"; general framing ok
confidence: high if reason uses only input facts; low if reason needs invented date/interval`;

/** Layer 3 — user-initiated organize (still compact). */
const ORGANIZE_PROMPT = `User tapped Organize. JSON only:
{"title":"","items":[],"suggestedDateText":"","suggestedAction":"","confidence":0.0}
items: max 5 from input only. confidence 0-1. Korean unless English input.`;

type ClassifyPayload = {
  category: string;
  title: string;
  suggestedDate: string;
  suggestedStart: string;
  reason: string;
  confidence: "high" | "low" | "";
};

type OrganizePayload = {
  title: string;
  items: string[];
  suggestedDateText: string;
  suggestedAction: string;
  confidence: number;
};

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("No JSON object in model response");
  }
}

function reasonHasDateClaim(reason: string): boolean {
  return /(?:\d\s*월|\d\s*일|\d+일\s*전|전에\s*\d+|월요일|화요일|수요일|목요일|금요일|토요일|일요일|\b(?:mon|tue|wed|thu|fri|sat|sun)day\b)/i.test(
    reason,
  );
}

function normalizeClassifyPayload(raw: unknown): ClassifyPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 30) : "";
  if (!title) return null;

  const category =
    typeof o.category === "string" ? o.category.trim().slice(0, 16) : "note";

  const suggestedDate =
    typeof o.suggestedDate === "string"
      ? o.suggestedDate.trim().slice(0, 24)
      : typeof o.suggestedDateText === "string"
        ? o.suggestedDateText.trim().slice(0, 24)
        : "";

  const suggestedStart =
    typeof o.suggestedStart === "string" ? o.suggestedStart.trim() : "";

  let reason = typeof o.reason === "string" ? o.reason.trim().slice(0, 120) : "";

  const confRaw =
    typeof o.confidence === "string" ? o.confidence.trim().toLowerCase() : "";
  let confidence: ClassifyPayload["confidence"] =
    confRaw === "high" || confRaw === "low" ? confRaw : "";

  if (reason && reasonHasDateClaim(reason)) {
    reason = "";
    confidence = "low";
  }
  if (confidence !== "high") {
    reason = "";
  }

  return { category, title, suggestedDate, suggestedStart, reason, confidence };
}

function normalizeOrganizePayload(raw: unknown): OrganizePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== "string") return null;

  const itemsRaw = o.items ?? o.tasks;
  const items = Array.isArray(itemsRaw)
    ? itemsRaw.filter((t): t is string => typeof t === "string").slice(0, 5)
    : [];

  const suggestedAction =
    typeof o.suggestedAction === "string"
      ? o.suggestedAction
      : typeof o.message === "string"
        ? o.message
        : "";

  if (items.length === 0) return null;

  const confidence =
    typeof o.confidence === "number"
      ? Math.min(1, Math.max(0, o.confidence))
      : 0.75;

  return {
    title: o.title.trim().slice(0, 30),
    items,
    suggestedDateText:
      typeof o.suggestedDateText === "string" ? o.suggestedDateText.trim() : "",
    suggestedAction: suggestedAction.trim(),
    confidence,
  };
}

async function callAnthropicJson(
  apiKey: string,
  system: string,
  userContent: string,
  maxTokens: number,
): Promise<unknown> {
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    throw new Error(`Anthropic ${upstream.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await upstream.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const block = data.content?.find((part) => part.type === "text");
  return extractJson(block?.text ?? "");
}

function readBearerToken(req: VercelRequest): string | null {
  const raw = req.headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

async function hasValidSupabaseSession(token: string): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    console.error("[brain-mirror] Missing Supabase server environment");
    return false;
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${token}`,
      },
    });
    return response.ok;
  } catch (error) {
    console.error("[brain-mirror] Supabase session verification failed", error);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const bearerToken = readBearerToken(req);
  if (!bearerToken || !(await hasValidSupabaseSession(bearerToken))) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }
  if (text.length > 8000) {
    return res.status(400).json({ error: "text too long" });
  }

  const mode =
    req.body?.mode === "organize" ? "organize" : ("classify" as const);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[brain-mirror] Missing ANTHROPIC_API_KEY");
    return res.status(503).json({ error: "API not configured" });
  }

  const input = text.slice(0, mode === "classify" ? 120 : 1200);

  try {
    if (mode === "organize") {
      const raw = await callAnthropicJson(
        apiKey,
        ORGANIZE_PROMPT,
        input,
        320,
      );
      const payload = normalizeOrganizePayload(raw);
      if (!payload) {
        return res.status(502).json({ error: "invalid model response" });
      }
      return res.status(200).json(payload);
    }

    const raw = await callAnthropicJson(apiKey, CLASSIFY_PROMPT, input, 128);
    const payload = normalizeClassifyPayload(raw);
    if (!payload) {
      return res.status(502).json({ error: "invalid model response" });
    }
    return res.status(200).json(payload);
  } catch (error) {
    console.error(`[brain-mirror] ${mode} error`, error);
    return res.status(502).json({ error: "model error" });
  }
}
