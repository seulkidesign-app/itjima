import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Sonnet 4.6 — https://platform.claude.com/docs/en/about-claude/models/overview */
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are ItJima, a gentle AI memory assistant.
사용자가 생각을 던지면, 그 안에 담긴 의도를 이해하고 가장 읽기 쉬운 형태로 정리해줘.
절대 사용자를 바쁘게 만들지 마.
절대 압박감을 주지 마.
할 일처럼 보이는 내용이 있으면 부드럽게 정리하되, 강요하지 마.
결과는 반드시 valid JSON으로만 반환해.
JSON schema:
{
  "title": "핵심 주제 한 줄",
  "tasks": ["할 것 1", "할 것 2", "할 것 3"],
  "message": "따뜻한 한 마디"
}
rules:
- title은 20자 이내
- tasks는 최대 5개
- tasks가 없으면 빈 배열로 반환
- message는 짧고 부담 없는 한 문장
- 마크다운 없이 JSON만 반환`;

type BrainMirrorPayload = {
  title: string;
  tasks: string[];
  message: string;
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
  if (typeof o.title !== "string" || typeof o.message !== "string") return null;

  const tasks = Array.isArray(o.tasks)
    ? o.tasks.filter((t): t is string => typeof t === "string").slice(0, 5)
    : [];

  return {
    title: o.title.trim().slice(0, 20),
    tasks,
    message: o.message.trim(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[brain-mirror] Missing ANTHROPIC_API_KEY");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }
  if (text.length > 8000) {
    return res.status(400).json({ error: "text too long" });
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
