import { detectDate } from "@/lib/dateDetect";

export type ThoughtCategory =
  | "schedule"
  | "shopping"
  | "reminder"
  | "link"
  | "task"
  | "list"
  | "idea"
  | "place"
  | "note";

export type ThoughtAnalysis = {
  /** 0–1 — high means rule engine handled it; skip AI */
  ruleConfidence: number;
  /** Layer 2 — only when local rules are uncertain */
  needsFallbackAi: boolean;
  /** Layer 3 — summarize/organize; user must tap "AI Organize" */
  needsUserAi: boolean;
  hasDate: boolean;
  actionCount: number;
  isJunk: boolean;
  isSimpleCapture: boolean;
  reasons: string[];
};

const JUNK = /^(asdf|test|ㅁㄴㅇㄹ|ㅋ+|ㅎ+|ㅠ+|\.+|…+|\?+|!+)$/i;
const URL_RE = /https?:\/\/[^\s]+/i;

const ACTION_SPLIT =
  /(?:하고|그리고|,|，|\/|\n|·|•|\d+[.)]\s*|\band\b|\bthen\b)/i;

const ORGANIZE_CUE =
  /(?:정리해|정리\s*해|분류해|묶어|요약해|summarize|organize|rewrite|다시\s*써)/i;

const ORGANIZE_ONLY =
  /(?:정리|분류|묶|그룹|organize|sort|group|category)/i;

export function extractLocalItems(text: string): string[] {
  const parts = text
    .split(ACTION_SPLIT)
    .map((s) =>
      s
        .trim()
        .replace(/^(?:오늘|내일|모레|today|tomorrow)\s*/i, "")
        .replace(URL_RE, "")
        .trim(),
    )
    .filter((s) => s.replace(/[\s\p{P}\p{S}]/gu, "").length >= 2);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }
  return unique.slice(0, 5);
}

function countActions(text: string): number {
  return extractLocalItems(text).length;
}

function hasOrganizationCue(text: string): boolean {
  return ORGANIZE_ONLY.test(text);
}

function wantsUserOrganize(text: string): boolean {
  return ORGANIZE_CUE.test(text);
}

function hasMultipleIntentions(text: string): boolean {
  const actions = countActions(text);
  if (actions >= 2) return true;
  return (
    /(그리고|또|및|and|also|plus)/i.test(text) &&
    text.replace(/[\s\p{P}\p{S}]/gu, "").length >= 12
  );
}

/** Rule Engine — Layer 1 gate (see PRODUCT_ROADMAP.md). */
export function analyzeThought(text: string): ThoughtAnalysis {
  const trimmed = text.trim();
  const meaningful = trimmed.replace(/[\s\p{P}\p{S}]/gu, "");
  const reasons: string[] = [];

  if (meaningful.length < 2) {
    return {
      ruleConfidence: 1,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate: false,
      actionCount: 0,
      isJunk: true,
      isSimpleCapture: true,
      reasons: ["too_short"],
    };
  }

  const isJunk = meaningful.length <= 6 && JUNK.test(meaningful);
  if (isJunk) {
    return {
      ruleConfidence: 0.95,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate: false,
      actionCount: 0,
      isJunk: true,
      isSimpleCapture: true,
      reasons: ["junk_pattern"],
    };
  }

  if (wantsUserOrganize(trimmed)) {
    return {
      ruleConfidence: 0.88,
      needsFallbackAi: false,
      needsUserAi: true,
      hasDate: !!detectDate(trimmed),
      actionCount: countActions(trimmed),
      isJunk: false,
      isSimpleCapture: false,
      reasons: ["user_organize_cue"],
    };
  }

  const dateHit = detectDate(trimmed);
  const hasDate = !!dateHit;
  const localItems = extractLocalItems(trimmed);
  const actionCount = localItems.length;
  const multi = hasMultipleIntentions(trimmed);
  const organize = hasOrganizationCue(trimmed);
  const hasUrl = URL_RE.test(trimmed);

  if (hasUrl && meaningful.length <= 48) {
    reasons.push("url_capture");
    return {
      ruleConfidence: 0.93,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate,
      actionCount,
      isJunk: false,
      isSimpleCapture: true,
      reasons,
    };
  }

  if (localItems.length >= 2) {
    reasons.push("local_list");
    return {
      ruleConfidence: 0.9,
      needsFallbackAi: false,
      needsUserAi: organize,
      hasDate,
      actionCount,
      isJunk: false,
      isSimpleCapture: !organize,
      reasons: organize ? [...reasons, "organization"] : reasons,
    };
  }

  if (hasDate && actionCount <= 1 && !organize) {
    reasons.push("simple_date");
    return {
      ruleConfidence: 0.92,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate: true,
      actionCount,
      isJunk: false,
      isSimpleCapture: true,
      reasons,
    };
  }

  if (actionCount === 1 && meaningful.length <= 32 && !hasDate && !organize) {
    reasons.push("single_action");
    return {
      ruleConfidence: 0.91,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate: false,
      actionCount,
      isJunk: false,
      isSimpleCapture: true,
      reasons,
    };
  }

  if (organize) {
    reasons.push("organization");
    return {
      ruleConfidence: 0.87,
      needsFallbackAi: false,
      needsUserAi: true,
      hasDate,
      actionCount,
      isJunk: false,
      isSimpleCapture: false,
      reasons,
    };
  }

  const longAmbiguous =
    meaningful.length >= 56 && actionCount <= 1 && !hasDate;
  const messyMulti =
    multi && actionCount <= 1 && meaningful.length >= 36;

  const needsFallbackAi = longAmbiguous || messyMulti;

  if (needsFallbackAi) {
    if (longAmbiguous) reasons.push("long_ambiguous");
    if (messyMulti) reasons.push("messy_multi");
  } else {
    reasons.push("simple_capture");
  }

  const ruleConfidence = needsFallbackAi ? 0.58 : 0.86;

  return {
    ruleConfidence,
    needsFallbackAi,
    needsUserAi: false,
    hasDate,
    actionCount,
    isJunk: false,
    isSimpleCapture: !needsFallbackAi,
    reasons,
  };
}

/** @deprecated Use shouldCallFallbackAi from localClassifier.ts */
export function shouldCallBrainMirror(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  const analysis = analyzeThought(trimmed);
  if (analysis.isJunk) return false;
  return analysis.needsFallbackAi;
}
