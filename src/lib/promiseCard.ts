import { detectDate } from "@/lib/dateDetect";
import {
  understandNaturalLanguage,
  type NlIntent,
  type ScheduleConfidence,
} from "@/lib/nlSchedule";
import {
  hasNaturalRepeatIntent,
  hasNaturalScheduleTime,
  resolveNaturalScheduleStart,
} from "@/lib/naturalScheduleDraft";
import type { ThoughtCategory } from "@/lib/ruleEngine";

export type PromisePrimaryAction =
  | "confirm_schedule"
  | "clarify_schedule"
  | "confirm_task_later"
  | "set_resurface"
  | "keep_task"
  | "archive"
  | "keep_note";

export type PromiseEditAction = "open_schedule_sheet" | "open_edit_menu";

export type ActualAction =
  | "inbox_only"
  | "schedule_on_confirm"
  | "archive_on_confirm"
  | "task_later_on_confirm";

export type PromiseCard = {
  icon: string;
  label: string;
  promise: string;
  primaryActionLabel: string;
  editActionLabel: string;
  primaryAction: PromisePrimaryAction;
  editAction: PromiseEditAction;
  category: ThoughtCategory;
  confidence: number;
  confidenceLevel: ScheduleConfidence;
  nlIntent: NlIntent;
  actualAction: ActualAction;
  detectedDate: { start: Date; end: Date; label: string } | null;
  rediscoveryEligible: boolean;
  scheduleCommitted: boolean;
  showClarifyChips: boolean;
  isSensitive: boolean;
};

const FORBIDDEN_PRE_CONFIRM = [
  /알려드릴/i,
  /알림/i,
  /notify/i,
  /remind you/i,
  /다시\s*보여/i,
  /show you again/i,
  /꺼내드릴/i,
  /bring.*back/i,
  /마트|근처|location|near you/i,
];

function iconForIntent(intent: NlIntent): string {
  switch (intent) {
    case "schedule_exact":
    case "schedule_clarify":
      return "📅";
    case "task":
      return "✓";
    case "archive":
      return "🗂";
    default:
      return "💭";
  }
}

function mapIntentToPrimary(intent: NlIntent): PromisePrimaryAction {
  switch (intent) {
    case "schedule_exact":
      return "confirm_schedule";
    case "schedule_clarify":
      return "clarify_schedule";
    case "task":
      return "confirm_task_later";
    case "archive":
      return "archive";
    default:
      return "keep_note";
  }
}

function mapIntentToActual(intent: NlIntent): ActualAction {
  switch (intent) {
    case "schedule_exact":
      return "schedule_on_confirm";
    case "archive":
      return "archive_on_confirm";
    case "task":
      return "task_later_on_confirm";
    default:
      return "inbox_only";
  }
}

function confidenceScore(level: ScheduleConfidence): number {
  if (level === "high") return 0.9;
  if (level === "medium") return 0.65;
  return 0.4;
}

/**
 * v1 exposes only the focused schedule/task interpretation surface. Archive,
 * memory, low-confidence notes, and recurrence stay quiet until their full
 * persistence semantics are validated end to end.
 */
export function shouldShowInlinePromise(
  text: string,
  lang: "ko" | "en",
): boolean {
  const trimmed = text.trim();
  if (hasNaturalRepeatIntent(trimmed)) return false;

  // Relative offsets such as “30분 뒤” or “in 2 hours” are legitimate timed
  // commitments even though the older date detector does not classify them.
  if (
    hasNaturalScheduleTime(trimmed) &&
    resolveNaturalScheduleStart(trimmed) !== null
  ) {
    return true;
  }

  const nl = understandNaturalLanguage(trimmed, lang);
  return (
    nl.confidence !== "low" &&
    (nl.intent === "schedule_exact" ||
      nl.intent === "schedule_clarify" ||
      nl.intent === "task")
  );
}

/** Deterministic promise copy — NL understanding first, no LLM on the hot path. */
export function buildPromiseCard(
  text: string,
  lang: "ko" | "en",
): PromiseCard {
  const trimmed = text.trim();
  const nl = understandNaturalLanguage(trimmed, lang);
  const dateHit = detectDate(trimmed);

  const primaryAction = mapIntentToPrimary(nl.intent);
  const actualAction = mapIntentToActual(nl.intent);

  return {
    icon: iconForIntent(nl.intent),
    label: nl.mirrorLine,
    promise: nl.mirrorDetail,
    primaryActionLabel:
      lang === "en" ? nl.primaryLabelEn : nl.primaryLabelKo,
    editActionLabel:
      nl.intent === "task"
        ? lang === "en"
          ? "Add date"
          : "날짜 추가"
        : lang === "en"
          ? "Adjust"
          : "수정",
    editAction: "open_edit_menu",
    primaryAction,
    category: nl.category,
    confidence: confidenceScore(nl.confidence),
    confidenceLevel: nl.confidence,
    nlIntent: nl.intent,
    actualAction,
    detectedDate: nl.detectedDate ?? dateHit,
    scheduleCommitted: false,
    rediscoveryEligible: false,
    showClarifyChips: nl.intent === "schedule_clarify",
    isSensitive: nl.isSensitive,
  };
}

export function validatePromiseHonesty(card: PromiseCard): string[] {
  const issues: string[] = [];
  const blob = `${card.label} ${card.promise}`;

  if (
    card.actualAction !== "schedule_on_confirm" &&
    /다시\s*보여|show you again|알려|notify|remind/i.test(blob) &&
    !card.promise.includes("정하기") &&
    !card.primaryActionLabel.includes("정하기")
  ) {
    issues.push("resurface or notify language without schedule commit path");
  }

  if (card.actualAction === "schedule_on_confirm") {
    for (const re of FORBIDDEN_PRE_CONFIRM) {
      if (re.test(blob)) issues.push(`pre-confirm overclaim: ${re.source}`);
    }
    if (!card.detectedDate) {
      issues.push("schedule_on_confirm without detectedDate");
    }
  }

  if (card.primaryAction === "confirm_schedule" && !card.detectedDate) {
    issues.push("confirm_schedule without detectedDate");
  }

  return issues;
}
