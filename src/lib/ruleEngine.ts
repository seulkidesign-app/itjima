import { detectDate } from "@/lib/dateDetect";

export type ThoughtAnalysis = {
  /** 0–1 — high means rule engine handled it; skip AI */
  ruleConfidence: number;
  needsBrainMirror: boolean;
  hasDate: boolean;
  actionCount: number;
  isJunk: boolean;
  isSimpleCapture: boolean;
  reasons: string[];
};

const JUNK = /^(asdf|test|ㅁㄴㅇㄹ|ㅋ+|ㅎ+|ㅠ+|\.+|…+|\?+|!+)$/i;

const ACTION_SPLIT = /(?:하고|그리고|,|，|\/|\n|·|•|\d+[.)]\s*)/;

function countActions(text: string): number {
  const parts = text
    .split(ACTION_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.replace(/[\s\p{P}\p{S}]/gu, "").length >= 2);
  return parts.length;
}

function hasOrganizationCue(text: string): boolean {
  return (
    /정리|분류|묶|그룹|organize|sort|group|category/i.test(text) ||
    countActions(text) >= 3
  );
}

function hasMultipleIntentions(text: string): boolean {
  const actions = countActions(text);
  if (actions >= 2) return true;
  return (
    /(그리고|또|및|and|also|plus)/i.test(text) &&
    text.replace(/[\s\p{P}\p{S}]/gu, "").length >= 12
  );
}

/** Rule Engine — first gate before any AI call (see PRODUCT_ROADMAP.md). */
export function analyzeThought(text: string): ThoughtAnalysis {
  const trimmed = text.trim();
  const meaningful = trimmed.replace(/[\s\p{P}\p{S}]/gu, "");
  const reasons: string[] = [];

  if (meaningful.length < 2) {
    return {
      ruleConfidence: 1,
      needsBrainMirror: false,
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
      needsBrainMirror: false,
      hasDate: false,
      actionCount: 0,
      isJunk: true,
      isSimpleCapture: true,
      reasons: ["junk_pattern"],
    };
  }

  const dateHit = detectDate(trimmed);
  const hasDate = !!dateHit;
  const actionCount = countActions(trimmed);
  const multi = hasMultipleIntentions(trimmed);
  const organize = hasOrganizationCue(trimmed);
  const longMessy = meaningful.length >= 48 && actionCount >= 1;

  if (hasDate && actionCount <= 1 && !organize) {
    reasons.push("simple_date");
    return {
      ruleConfidence: 0.92,
      needsBrainMirror: false,
      hasDate: true,
      actionCount,
      isJunk: false,
      isSimpleCapture: true,
      reasons,
    };
  }

  if (actionCount === 1 && meaningful.length <= 28 && !hasDate && !organize) {
    reasons.push("single_action");
    return {
      ruleConfidence: 0.91,
      needsBrainMirror: false,
      hasDate: false,
      actionCount,
      isJunk: false,
      isSimpleCapture: true,
      reasons,
    };
  }

  const needsBrainMirror =
    multi ||
    actionCount >= 3 ||
    organize ||
    longMessy ||
    (hasDate && actionCount >= 2);

  if (needsBrainMirror) {
    if (multi) reasons.push("multiple_intentions");
    if (actionCount >= 3) reasons.push("many_actions");
    if (organize) reasons.push("organization");
    if (longMessy) reasons.push("long_messy");
    if (hasDate && actionCount >= 2) reasons.push("date_plus_actions");
  } else {
    reasons.push("simple_capture");
  }

  const ruleConfidence = needsBrainMirror ? 0.55 : 0.88;

  return {
    ruleConfidence,
    needsBrainMirror,
    hasDate,
    actionCount,
    isJunk: false,
    isSimpleCapture: !needsBrainMirror,
    reasons,
  };
}

/** Whether Brain Mirror (Small AI) should run for this thought. */
export function shouldCallBrainMirror(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  const newlineCount = (trimmed.match(/\n/g) || []).length;
  if (newlineCount >= 2) return true;
  const meaningful = trimmed.replace(/[\s\p{P}\p{S}]/gu, "");
  return meaningful.length >= 50;
}
