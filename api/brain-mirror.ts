import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Haiku 4.5 — https://platform.claude.com/docs/en/about-claude/models/overview */
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

/**
 * General AI surfaces stay beta-gated. Schedule normalization has its own
 * opt-in so the trust fallback can be evaluated independently.
 */
const AI_BETA_ENABLED = process.env.ENABLE_AI_BETA === "true";
const AI_SCHEDULE_ENABLED =
  process.env.ENABLE_AI_SCHEDULE === "true" || AI_BETA_ENABLED;

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

/**
 * V0.3 trust fallback. The model may normalize language, never fill missing
 * facts. The client feeds normalizedText back through deterministic safety
 * validation before anything can be saved.
 */
const SCHEDULE_PROMPT = `You normalize ONE Korean or English schedule sentence for a strict deterministic parser.
JSON only: {"decision":"normalized|ambiguous|not_schedule|unsupported","normalizedText":"","confidence":"high|medium|low","ambiguity":""}
Rules:
- NEVER invent a date, weekday, time, AM/PM, duration, place, title, or reminder.
- NEVER calculate relative dates into calendar dates. Keep relative meaning as words.
- Only expand colloquial spelling/shorthand into equivalent explicit wording.
- Preserve the user's event/title words; do not rewrite their meaning.
- If AM/PM is missing for a 1-12 clock and no explicit daypart proves it, decision=ambiguous, ambiguity=meridiem.
- If a daypart has no exact clock, decision=ambiguous, ambiguity=time.
- If a night phrase could cross midnight, decision=ambiguous, ambiguity=day_boundary.
- If there are 2+ events/times, decision=unsupported, ambiguity=multiple_events.
- If recurrence is requested, decision=unsupported, ambiguity=recurrence.
- If it is not a schedule-like statement, decision=not_schedule.
- decision=normalized only when the rewrite contains exactly the same scheduling facts as the input.
Examples:
"담주 금욜 저녁 7시 치과" -> {"decision":"normalized","normalizedText":"다음 주 금요일 오후 7시 치과","confidence":"high","ambiguity":""}
"낼 3시 치과" -> {"decision":"ambiguous","normalizedText":"내일 3시 치과","confidence":"high","ambiguity":"meridiem"}
"내일 저녁에 치과" -> {"decision":"ambiguous","normalizedText":"내일 저녁에 치과","confidence":"high","ambiguity":"time"}`;

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

type SchedulePayload = {
  decision: "normalized" | "ambiguous" | "not_schedule" | "unsupported";
  normalizedText: string;
  confidence: "high" | "medium" | "low";
  ambiguity: string;
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

function normalizeSchedulePayload(raw: unknown): SchedulePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const decision =
    typeof o.decision === "string" ? o.decision.trim().toLowerCase() : "";
  if (
    decision !== "normalized" &&
    decision !== "ambiguous" &&
    decision !== "not_schedule" &&
    decision !== "unsupported"
  ) {
    return null;
  }

  const confidenceRaw =
    typeof o.confidence === "string" ? o.confidence.trim().toLowerCase() : "";
  const confidence: SchedulePayload["confidence"] =
    confidenceRaw === "high" ||
    confidenceRaw === "medium" ||
    confidenceRaw === "low"
      ? confidenceRaw
      : "low";

  const normalizedText =
    typeof o.normalizedText === "string"
      ? o.normalizedText.trim().slice(0, 240)
      : "";
  const ambiguity =
    typeof o.ambiguity === "string" ? o.ambiguity.trim().slice(0, 40) : "";

  if (decision === "normalized" && (!normalizedText || confidence !== "high")) {
    return null;
  }

  return {
    decision,
    normalizedText,
    confidence,
    ambiguity,
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

  const mode =
    req.body?.mode === "organize"
      ? "organize"
      : req.body?.mode === "schedule"
        ? "schedule"
        : ("classify" as const);

  if (mode === "schedule" ? !AI_SCHEDULE_ENABLED : !AI_BETA_ENABLED) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).json({ error: "AI mode disabled" });
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

  const input = text.slice(
    0,
    mode === "organize" ? 1200 : mode === "schedule" ? 240 : 120,
  );

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

    if (mode === "schedule") {
      const raw = await callAnthropicJson(apiKey, SCHEDULE_PROMPT, input, 180);
      const payload = normalizeSchedulePayload(raw);
      if (!payload) {
        return res.status(502).json({ error: "invalid model response" });
      }
      res.setHeader("Cache-Control", "no-store");
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
