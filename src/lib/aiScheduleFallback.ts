import {
  evaluateTimedAutoCommit,
  type AutoCommitBlockReason,
} from "@/lib/nlAutoCommit";
import { hasNaturalScheduleTime, type NaturalScheduleDraft } from "@/lib/naturalScheduleDraft";

export type AiScheduleDecision =
  | "normalized"
  | "ambiguous"
  | "not_schedule"
  | "unsupported";

export type AiSchedulePayload = {
  decision: AiScheduleDecision;
  normalizedText: string;
  confidence: "high" | "medium" | "low";
  ambiguity: string;
};

export type AiScheduleFallbackOutcome =
  | {
      status: "safe";
      normalizedText: string;
      draft: NaturalScheduleDraft;
    }
  | {
      status: "not_safe";
      reason: string;
      payload?: AiSchedulePayload;
    }
  | { status: "unavailable" }
  | { status: "skipped" };

const EXPLICIT_PERIOD_RE =
  /(?:오전|오후|아침|점심|저녁|밤|새벽|\b(?:morning|afternoon|evening|tonight|noon|midnight)\b|\b(?:am|pm)\b)/i;

const BARE_12H_CLOCK_RE =
  /(?:^|\s)(1[0-2]|[1-9])\s*시(?:\s*(?:반|\d{1,2}\s*분))?(?:\s|$)|\bat\s+(1[0-2]|[1-9])(?::[0-5]\d)?(?!\s*(?:am|pm)\b)/i;

const EXPLICIT_24H_AFTER_NOON_RE =
  /\b(?:1[3-9]|2[0-3]):[0-5]\d\b|(?:1[3-9]|2[0-3])\s*시/;

/**
 * The model is only useful when the deterministic parser saw a real time but
 * could not resolve the date language. Existing ambiguity UI remains local.
 */
export function shouldTryAiScheduleFallback(
  text: string,
  reason: AutoCommitBlockReason,
): boolean {
  if (reason !== "unresolved_date") return false;
  if (!hasNaturalScheduleTime(text)) return false;

  // A bare 1–12 clock still lacks AM/PM. Do not ask a model to infer it from
  // semantics; keep the raw input rather than trading friction for a wrong save.
  if (!EXPLICIT_PERIOD_RE.test(text) && BARE_12H_CLOCK_RE.test(text)) {
    return false;
  }
  return true;
}

export function parseAiSchedulePayload(raw: unknown): AiSchedulePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const decision = typeof o.decision === "string" ? o.decision : "";
  if (
    decision !== "normalized" &&
    decision !== "ambiguous" &&
    decision !== "not_schedule" &&
    decision !== "unsupported"
  ) {
    return null;
  }

  const confidence = typeof o.confidence === "string" ? o.confidence : "";
  if (confidence !== "high" && confidence !== "medium" && confidence !== "low") {
    return null;
  }

  const normalizedText =
    typeof o.normalizedText === "string" ? o.normalizedText.trim() : "";
  const ambiguity = typeof o.ambiguity === "string" ? o.ambiguity.trim() : "";

  if (decision === "normalized" && (!normalizedText || confidence !== "high")) {
    return null;
  }

  return {
    decision,
    normalizedText: normalizedText.slice(0, 240),
    confidence,
    ambiguity: ambiguity.slice(0, 40),
  };
}

/**
 * Last client-side honesty check before the normalized sentence is allowed
 * back into the deterministic parser. In particular, the model may not invent
 * PM/AM when the original sentence never supplied a daypart.
 */
export function isFaithfulScheduleNormalization(
  original: string,
  normalized: string,
): boolean {
  const source = original.trim();
  const target = normalized.trim();
  if (!source || !target) return false;

  const sourceHasPeriod = EXPLICIT_PERIOD_RE.test(source);
  const targetHasPeriod = EXPLICIT_PERIOD_RE.test(target);
  if (!sourceHasPeriod && targetHasPeriod) return false;
  if (!sourceHasPeriod && EXPLICIT_24H_AFTER_NOON_RE.test(target)) return false;

  // Never let normalization add recurrence or an extra reminder instruction.
  const sourceRepeat = /(?:매일|매주|매월|매달|매년|every\s+(?:day|week|month|year))/i.test(source);
  const targetRepeat = /(?:매일|매주|매월|매달|매년|every\s+(?:day|week|month|year))/i.test(target);
  if (!sourceRepeat && targetRepeat) return false;

  const sourceReminder = /(?:알려|알림|리마인드|remind|notify)/i.test(source);
  const targetReminder = /(?:알려|알림|리마인드|remind|notify)/i.test(target);
  if (!sourceReminder && targetReminder) return false;

  return true;
}

export async function tryAiScheduleFallback(
  text: string,
  lang: "ko" | "en",
  now = new Date(),
  signal?: AbortSignal,
): Promise<AiScheduleFallbackOutcome> {
  const initial = evaluateTimedAutoCommit(text, lang, now);
  if (initial.ok || !shouldTryAiScheduleFallback(text, initial.reason)) {
    return { status: "skipped" };
  }

  try {
    const response = await fetch("/api/brain-mirror", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim(), mode: "schedule" }),
      signal: signal ?? AbortSignal.timeout(1800),
    });

    if (!response.ok) return { status: "unavailable" };
    const payload = parseAiSchedulePayload(await response.json());
    if (!payload) return { status: "not_safe", reason: "invalid_payload" };
    if (payload.decision !== "normalized") {
      return {
        status: "not_safe",
        reason: payload.decision,
        payload,
      };
    }
    if (!isFaithfulScheduleNormalization(text, payload.normalizedText)) {
      return {
        status: "not_safe",
        reason: "unfaithful_normalization",
        payload,
      };
    }

    // The model never gets the final say. It only rewrites the sentence; the
    // same deterministic trust gate must approve the normalized result.
    const checked = evaluateTimedAutoCommit(payload.normalizedText, lang, now);
    if (!checked.ok) {
      return {
        status: "not_safe",
        reason: `local_${checked.reason}`,
        payload,
      };
    }

    return {
      status: "safe",
      normalizedText: payload.normalizedText,
      draft: checked.draft,
    };
  } catch {
    return { status: "unavailable" };
  }
}
