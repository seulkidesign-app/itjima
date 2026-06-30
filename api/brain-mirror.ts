import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Sonnet 4.6 — https://platform.claude.com/docs/en/about-claude/models/overview */
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are ItJima. The user drops a messy thought — you understand it first, quietly.
Never pressure the user to organize. Never ask questions. Act with gentle confidence.
Return ONLY valid JSON, no markdown.

JSON schema:
{
  "title": "핵심 주제 (20자 이내, 필요하면 이모지 1개)",
  "items": ["항목1", "항목2"],
  "suggestedDateText": "내일",
  "suggestedAction": "내일 일정으로 넣어둘게요.",
  "confidence": 0.85
}

rules:
- items: max 5, short action phrases (e.g. "꽃 구매", "병원 방문")
- suggestedDateText: empty string if no date inferred
- suggestedAction: one calm sentence, future tense, as if you will handle it (e.g. "내일 일정으로 넣어둘게요.")
- confidence: 0.0-1.0
- Korean unless input is clearly English`;

type BrainMirrorPayload = {
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

function normalizePayload(raw: unknown): BrainMirrorPayload | null {
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

  if (!suggestedAction && items.length === 0) return null;

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[brain-mirror] Missing ANTHROPIC_API_KEY");
    return res.status(503).json({ error: "API not configured" });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: text }],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("[brain-mirror] Anthropic error", upstream.status, detail);
      return res.status(502).json({ error: "upstream failed" });
    }

    const data = (await upstream.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const block = data.content?.find((part) => part.type === "text");
    const rawText = block?.text ?? "";
    const parsed = normalizePayload(extractJson(rawText));

    if (!parsed) {
      console.error("[brain-mirror] Invalid model JSON:", rawText.slice(0, 200));
      return res.status(502).json({ error: "invalid model response" });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("[brain-mirror]", error);
    return res.status(500).json({ error: "internal error" });
  }
}
