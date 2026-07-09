import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Haiku 4.5 — https://platform.claude.com/docs/en/about-claude/models/overview */
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

/** Layer 2 — minimal classify prompt (<150 tokens). JSON only. */
const CLASSIFY_PROMPT = `JSON only: {"category":"","title":"","suggestedDate":""}
category: schedule|shopping|reminder|task|list|note
title: max 18 chars from input
suggestedDate: date word from input or ""`;

/** Layer 3 — user-initiated organize (still compact). */
const ORGANIZE_PROMPT = `User tapped Organize. JSON only:
{"title":"","items":[],"suggestedDateText":"","suggestedAction":"","confidence":0.0}
items: max 5 from input only. confidence 0-1. Korean unless English input.`;

type ClassifyPayload = {
  category: string;
  title: string;
  suggestedDate: string;
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

  return { category, title, suggestedDate };
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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

    const raw = await callAnthropicJson(apiKey, CLASSIFY_PROMPT, input, 72);
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
