import { detectDate, archiveGroup } from "@/lib/dateDetect";
import {
  analyzeThought,
  extractLocalItems,
  type ThoughtCategory,
} from "@/lib/ruleEngine";
import {
  finalizeBrainMirror,
  suggestedActionForDate,
  type BrainMirrorResult,
} from "@/lib/brainMirror";
import { getCachedAiResult } from "@/lib/aiCache";

const URL_RE = /https?:\/\/[^\s]+/i;
const SHOPPING_RE =
  /(?:구매|장보|마트|쇼핑|장보기|사야|사올|buy|grocery|groceries|pick\s*up)/i;
const REMINDER_RE =
  /(?:알림|리마인|remind|don't\s+forget|잊지\s*말|꼭\s*(?:해|하)|remember\s+to)/i;

export type IntelligenceKind =
  | "local"
  | "cache"
  | "needs_fallback_ai"
  | "needs_user_ai"
  | "skip";

export type IntelligenceResolution = {
  kind: IntelligenceKind;
  result?: BrainMirrorResult;
  category?: ThoughtCategory;
  confidence: number;
  reasons: string[];
};

function detectCategory(text: string, hasDate: boolean): ThoughtCategory {
  if (URL_RE.test(text) && text.replace(URL_RE, "").trim().length < 24) {
    return "link";
  }
  if (SHOPPING_RE.test(text)) return "shopping";
  if (REMINDER_RE.test(text)) return "reminder";
  if (hasDate) return "schedule";
  const group = archiveGroup(text).key;
  if (group === "todo") return "task";
  if (group === "idea") return "idea";
  if (group === "place") return "place";
  const items = extractLocalItems(text);
  if (items.length >= 2) return "list";
  return "note";
}

function buildTitle(
  text: string,
  category: ThoughtCategory,
  items: string[],
  dateLabel: string,
): string {
  const first = items[0] ?? text.split("\n")[0]?.trim() ?? text;
  const short = first.length > 22 ? `${first.slice(0, 20).trim()}…` : first;

  if (category === "link") return "링크 🔗";
  if (category === "shopping") return items.length > 1 ? "장보기 🛒" : short;
  if (category === "reminder") return dateLabel ? `알림 · ${dateLabel}` : "알림 ⏰";
  if (category === "schedule" && dateLabel) return `${dateLabel} · ${short}`;
  if (category === "list" && items.length >= 2) {
    return items.length >= 3 ? `${short} 외 ${items.length - 1}개` : short;
  }
  return short.length > 2 ? short : text.slice(0, 22).trim();
}

function toMirrorResult(
  text: string,
  category: ThoughtCategory,
  items: string[],
  confidence: number,
  dateLabel: string,
): BrainMirrorResult {
  const title = buildTitle(text, category, items, dateLabel);
  return finalizeBrainMirror(
    {
      title,
      items: items.slice(0, 5),
      suggestedDateText: dateLabel,
      suggestedAction: dateLabel ? suggestedActionForDate(dateLabel) : "",
      confidence,
    },
    null,
  );
}

/** Layer 1 — rule-based classification. High confidence → no AI. */
export function classifyLocally(text: string): IntelligenceResolution | null {
  const trimmed = text.trim();
  if (trimmed.length < 2) return null;

  const analysis = analyzeThought(trimmed);
  if (analysis.isJunk) {
    return { kind: "skip", confidence: analysis.ruleConfidence, reasons: analysis.reasons };
  }

  if (analysis.needsUserAi) {
    return {
      kind: "needs_user_ai",
      confidence: analysis.ruleConfidence,
      reasons: analysis.reasons,
    };
  }

  const dateHit = detectDate(trimmed);
  const dateLabel = dateHit?.label ?? "";
  const items = extractLocalItems(trimmed);
  const category = detectCategory(trimmed, !!dateHit);

  if (analysis.ruleConfidence >= 0.85 && !analysis.needsFallbackAi) {
    const mirrorItems =
      items.length > 0
        ? items
        : category === "link"
          ? [trimmed.match(URL_RE)?.[0] ?? trimmed.slice(0, 40)]
          : [trimmed.split("\n")[0]?.trim() || trimmed.slice(0, 40)];

    return {
      kind: "local",
      category,
      confidence: analysis.ruleConfidence,
      reasons: analysis.reasons,
      result: toMirrorResult(
        trimmed,
        category,
        mirrorItems,
        analysis.ruleConfidence,
        dateLabel,
      ),
    };
  }

  if (analysis.needsFallbackAi) {
    return {
      kind: "needs_fallback_ai",
      category,
      confidence: analysis.ruleConfidence,
      reasons: analysis.reasons,
    };
  }

  return {
    kind: "skip",
    confidence: analysis.ruleConfidence,
    reasons: analysis.reasons,
  };
}

/** Resolve intelligence layer — cache → local → fallback AI gate. */
export function resolveIntelligence(text: string): IntelligenceResolution {
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    return { kind: "skip", confidence: 1, reasons: ["too_short"] };
  }

  const cached = getCachedAiResult(trimmed);
  if (cached?.items.length) {
    return {
      kind: "cache",
      confidence: cached.confidence,
      reasons: ["cache_hit"],
      result: finalizeBrainMirror(cached, null),
    };
  }

  const local = classifyLocally(trimmed);
  return local ?? { kind: "skip", confidence: 0.5, reasons: ["unclassified"] };
}

export function needsReflection(text: string): boolean {
  const r = resolveIntelligence(text);
  return (
    r.kind === "local" ||
    r.kind === "cache" ||
    r.kind === "needs_fallback_ai" ||
    r.kind === "needs_user_ai"
  );
}

export function shouldCallFallbackAi(text: string): boolean {
  return resolveIntelligence(text).kind === "needs_fallback_ai";
}

export function needsUserInitiatedAi(text: string): boolean {
  return resolveIntelligence(text).kind === "needs_user_ai";
}
