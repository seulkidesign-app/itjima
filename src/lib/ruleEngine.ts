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
  hasTime: boolean;
  actionCount: number;
  isJunk: boolean;
  isSimpleCapture: boolean;
  category?: ThoughtCategory;
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

const SHOPPING_RE =
  /(?:구매|장보|마트|쇼핑|장보기|사야|사올|buy|grocery|groceries|pick\s*up|우유|계란|김치|빵|과일)/i;

const REMINDER_RE =
  /(?:알림|리마인|remind|don't\s+forget|잊지\s*말|꼭\s*(?:해|하)|remember\s+to)/i;

const TASK_RE =
  /(?:해야|하자|하기|할\s*것|todo|to-do|to\s+do|submit|send|call|email|회의|미팅|appointment|병원|dentist)/i;

const PLACE_RE =
  /(?:카페|식당|병원|약국|학교|회사|공항|역|근처|near|at\s+the)/i;

const TIME_RE =
  /(?:\d{1,2}\s*시|\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm)\b|오전|오후)/i;

const WEEKDAY_RE =
  /(?:일|월|화|수|목|금|토)요일|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

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
    text.replace(/[\s\p{P}\p{S}]/gu, "").length >= 16
  );
}

function inferCategory(
  text: string,
  hasDate: boolean,
  hasTime: boolean,
  actionCount: number,
): ThoughtCategory {
  if (URL_RE.test(text) && text.replace(URL_RE, "").trim().length < 28) {
    return "link";
  }
  if (SHOPPING_RE.test(text)) return "shopping";
  if (REMINDER_RE.test(text)) return "reminder";
  if (hasDate || hasTime || WEEKDAY_RE.test(text)) return "schedule";
  if (PLACE_RE.test(text)) return "place";
  if (TASK_RE.test(text)) return "task";
  if (actionCount >= 2) return "list";
  if (/(?:아이디어|idea|생각)/i.test(text)) return "idea";
  return "note";
}

/** Rule Engine — Layer 1 gate. High confidence → never call AI. */
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
      hasTime: false,
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
      hasTime: false,
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
      hasTime: TIME_RE.test(trimmed),
      actionCount: countActions(trimmed),
      isJunk: false,
      isSimpleCapture: false,
      reasons: ["user_organize_cue"],
    };
  }

  const dateHit = detectDate(trimmed);
  const hasDate = !!dateHit;
  const hasTime = TIME_RE.test(trimmed);
  const localItems = extractLocalItems(trimmed);
  const actionCount = localItems.length;
  const multi = hasMultipleIntentions(trimmed);
  const organize = hasOrganizationCue(trimmed);
  const hasUrl = URL_RE.test(trimmed);
  const category = inferCategory(trimmed, hasDate, hasTime, actionCount);

  if (hasUrl && meaningful.length <= 56) {
    reasons.push("url_capture");
    return {
      ruleConfidence: 0.94,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate,
      hasTime,
      actionCount,
      isJunk: false,
      isSimpleCapture: true,
      category: "link",
      reasons,
    };
  }

  if (SHOPPING_RE.test(trimmed) && meaningful.length <= 64) {
    reasons.push("shopping_keyword");
    return {
      ruleConfidence: 0.93,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate,
      hasTime,
      actionCount: Math.max(actionCount, 1),
      isJunk: false,
      isSimpleCapture: true,
      category: "shopping",
      reasons,
    };
  }

  if (REMINDER_RE.test(trimmed) && meaningful.length <= 72) {
    reasons.push("reminder_keyword");
    return {
      ruleConfidence: 0.93,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate,
      hasTime,
      actionCount: Math.max(actionCount, 1),
      isJunk: false,
      isSimpleCapture: true,
      category: "reminder",
      reasons,
    };
  }

  if ((hasDate || hasTime || WEEKDAY_RE.test(trimmed)) && actionCount <= 2) {
    reasons.push("schedule_signal");
    return {
      ruleConfidence: 0.94,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate,
      hasTime,
      actionCount: Math.max(actionCount, 1),
      isJunk: false,
      isSimpleCapture: true,
      category: "schedule",
      reasons,
    };
  }

  if (localItems.length >= 2) {
    reasons.push("local_list");
    return {
      ruleConfidence: 0.91,
      needsFallbackAi: false,
      needsUserAi: organize,
      hasDate,
      hasTime,
      actionCount,
      isJunk: false,
      isSimpleCapture: !organize,
      category: "list",
      reasons: organize ? [...reasons, "organization"] : reasons,
    };
  }

  if (hasDate && actionCount <= 1 && !organize) {
    reasons.push("simple_date");
    return {
      ruleConfidence: 0.94,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate: true,
      hasTime,
      actionCount: Math.max(actionCount, 1),
      isJunk: false,
      isSimpleCapture: true,
      category: "schedule",
      reasons,
    };
  }

  if (
    (TASK_RE.test(trimmed) || PLACE_RE.test(trimmed)) &&
    meaningful.length <= 48 &&
    !organize
  ) {
    reasons.push("task_or_place");
    return {
      ruleConfidence: 0.9,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate,
      hasTime,
      actionCount: Math.max(actionCount, 1),
      isJunk: false,
      isSimpleCapture: true,
      category,
      reasons,
    };
  }

  if (actionCount === 1 && meaningful.length <= 40 && !hasDate && !organize) {
    reasons.push("single_action");
    return {
      ruleConfidence: 0.92,
      needsFallbackAi: false,
      needsUserAi: false,
      hasDate: false,
      hasTime,
      actionCount,
      isJunk: false,
      isSimpleCapture: true,
      category,
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
      hasTime,
      actionCount,
      isJunk: false,
      isSimpleCapture: false,
      category,
      reasons,
    };
  }

  const longAmbiguous =
    meaningful.length >= 80 && actionCount <= 1 && !hasDate && !hasTime;
  const messyMulti =
    multi && actionCount <= 1 && meaningful.length >= 56 && !hasDate;

  const needsFallbackAi = longAmbiguous || messyMulti;

  if (needsFallbackAi) {
    if (longAmbiguous) reasons.push("long_ambiguous");
    if (messyMulti) reasons.push("messy_multi");
  } else {
    reasons.push("simple_capture");
  }

  const ruleConfidence = needsFallbackAi ? 0.52 : 0.88;

  return {
    ruleConfidence,
    needsFallbackAi,
    needsUserAi: false,
    hasDate,
    hasTime,
    actionCount,
    isJunk: false,
    isSimpleCapture: !needsFallbackAi,
    category,
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
