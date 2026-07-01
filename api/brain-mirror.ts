import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Haiku 4.5 — https://platform.claude.com/docs/en/about-claude/models/overview */
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are ItJima. The user drops a messy thought — you understand it first, quietly.
Never pressure the user to organize. Never ask questions. Act with gentle confidence.
Return ONLY valid JSON, no markdown.

JSON schema:
{
  "title": "핵심 주제 (20자 이내, 필요하면 이모지 1개)",
  "items": ["항목1", "항목2"],
  "suggestedDateText": "내일",
  "suggestedAction": "내일과 관련된 생각 같아요.",
  "confidence": 0.85
}

rules:
- items: max 5, short action phrases (e.g. "꽃 구매", "병원 방문")
- DO NOT add items that the user did not explicitly mention. Only extract, never invent.
- items must ONLY contain actions/things explicitly mentioned in the user's raw text. Never invent or suggest items not in the input.
- If there are no extractable items from the input, return items as empty array []
- suggestedDateText: empty string if no date inferred
- suggestedAction: one calm observational sentence (e.g. "내일과 관련된 생각 같아요.")
- Never imply you already completed an action (no "넣어뒀어요", "등록했어요", "처리했어요")
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
      max_tokens: 512,
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

async function generateBrainMirrorDraft(
  apiKey: string,
  rawText: string,
): Promise<BrainMirrorPayload | null> {
  try {
    const raw = await callAnthropicJson(apiKey, SYSTEM_PROMPT, rawText);
    return normalizePayload(raw);
  } catch (error) {
    console.error("[brain-mirror] generation error", error);
    return null;
  }
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

  const draft = await generateBrainMirrorDraft(apiKey, text);
  if (!draft) {
    return res.status(502).json({ error: "invalid model response" });
  }

  return res.status(200).json(draft);
}
