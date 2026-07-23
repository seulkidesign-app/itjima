import { detectDate } from "@/lib/dateDetect";
import { classifyLocally } from "@/lib/localClassifier";
import { analyzeThought, type ThoughtCategory } from "@/lib/ruleEngine";
import { formatSuggestedMoment } from "@/lib/scheduleChoices";

export type PromisePrimaryAction =
  | "confirm_schedule"
  | "keep_task"
  | "archive"
  | "keep_note";

export type PromiseEditAction = "open_schedule_sheet" | "open_edit_menu";

/** Actions the system will actually perform when the user accepts. */
export type ActualAction =
  | "inbox_only"
  | "schedule_on_confirm"
  | "archive_on_confirm";

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
  actualAction: ActualAction;
  detectedDate: { start: Date; end: Date; label: string } | null;
  /** Archive path may surface via rediscovery after aging — never immediate. */
  rediscoveryEligible: boolean;
  /** True only after schedule exists — used by validators, not shown pre-confirm. */
  scheduleCommitted: boolean;
};

const REDISCOVERY_ARCHIVE_CATEGORIES = new Set<ThoughtCategory>([
  "idea",
  "note",
  "task",
  "list",
  "place",
]);

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

function formatSchedulePrompt(
  start: Date,
  lang: "ko" | "en",
): string {
  const moment = formatSuggestedMoment(start, lang);
  return lang === "en"
    ? `Schedule for ${moment}?`
    : `${moment}로 잡을까요?`;
}

function scheduleLabel(dateLabel: string, lang: "ko" | "en"): string {
  if (lang === "en") {
    return dateLabel
      ? `📅 Looks like ${dateLabel.toLowerCase()}`
      : "📅 Looks like a schedule";
  }
  return dateLabel ? `📅 ${dateLabel} 일정 같아요` : "📅 일정 같아요";
}

function rediscoveryPromise(lang: "ko" | "en"): string {
  return lang === "en"
    ? "I'll tuck it away and revisit it in a few days."
    : "며칠 뒤 다시 꺼내볼게요.";
}

/** Deterministic promise copy — no LLM. */
export function buildPromiseCard(
  text: string,
  lang: "ko" | "en",
): PromiseCard {
  const trimmed = text.trim();
  const analysis = analyzeThought(trimmed);
  const resolution = classifyLocally(trimmed);
  const dateHit = detectDate(trimmed);
  const category =
    resolution?.category ??
    analysis.category ??
    (dateHit ? "schedule" : "note");
  const confidence = Math.max(
    resolution?.confidence ?? 0,
    analysis.ruleConfidence,
  );

  const base = {
    category,
    confidence,
    detectedDate: dateHit,
    scheduleCommitted: false,
    editActionLabel: lang === "en" ? "Edit" : "수정",
    editAction: "open_edit_menu" as const,
  };

  if (dateHit && !analysis.isJunk) {
    return {
      ...base,
      icon: "📅",
      label: scheduleLabel(dateHit.label, lang),
      promise: formatSchedulePrompt(dateHit.start, lang),
      primaryActionLabel:
        lang === "en" ? "Schedule as suggested" : "이대로 일정 잡기",
      primaryAction: "confirm_schedule",
      editAction: "open_schedule_sheet",
      actualAction: "schedule_on_confirm",
      rediscoveryEligible: false,
    };
  }

  if (category === "task" || category === "reminder") {
    return {
      ...base,
      icon: "✓",
      label:
        lang === "en" ? "✓ Keeping this as a task" : "✓ 할 일로 맡아둘게요",
      promise:
        lang === "en"
          ? "You can set a time whenever you're ready."
          : "시간은 나중에 정해도 괜찮아요.",
      primaryActionLabel: lang === "en" ? "Keep as task" : "할 일로 두기",
      primaryAction: "keep_task",
      actualAction: "inbox_only",
      rediscoveryEligible: false,
    };
  }

  if (category === "link") {
    return {
      ...base,
      icon: "🔗",
      label: lang === "en" ? "🔗 Saved as a link" : "🔗 링크로 맡아뒀어요",
      promise:
        lang === "en"
          ? "It's here whenever you want to open it."
          : "나중에 다시 열 수 있어요.",
      primaryActionLabel: lang === "en" ? "Keep it here" : "그대로 맡기기",
      primaryAction: "keep_note",
      actualAction: "inbox_only",
      rediscoveryEligible: false,
    };
  }

  if (category === "shopping") {
    return {
      ...base,
      icon: "🛒",
      label:
        lang === "en" ? "🛒 Saved to pick up later" : "🛒 장보기로 맡아뒀어요",
      promise:
        lang === "en"
          ? "It's on your list until you're ready."
          : "필요할 때 목록에서 볼 수 있어요.",
      primaryActionLabel: lang === "en" ? "Keep it here" : "그대로 맡기기",
      primaryAction: "keep_task",
      actualAction: "inbox_only",
      rediscoveryEligible: false,
    };
  }

  if (
    REDISCOVERY_ARCHIVE_CATEGORIES.has(category) &&
    confidence >= 0.65 &&
    !analysis.isJunk
  ) {
    return {
      ...base,
      icon: "💭",
      label:
        lang === "en" ? "💭 Saved as an idea" : "💭 아이디어로 보관했어요",
      promise: rediscoveryPromise(lang),
      primaryActionLabel: lang === "en" ? "Keep it safe" : "그대로 맡기기",
      primaryAction: "archive",
      actualAction: "archive_on_confirm",
      rediscoveryEligible: true,
    };
  }

  if (confidence < 0.65 || analysis.isJunk) {
    return {
      ...base,
      icon: "✓",
      label: lang === "en" ? "✓ Saved for you" : "✓ 맡아뒀어요",
      promise:
        lang === "en"
          ? "It's here whenever you need it."
          : "필요할 때 여기서 볼 수 있어요.",
      primaryActionLabel: lang === "en" ? "Keep it here" : "그대로 맡기기",
      primaryAction: "keep_note",
      actualAction: "inbox_only",
      rediscoveryEligible: false,
    };
  }

  return {
    ...base,
    icon: "💭",
    label: lang === "en" ? "💭 Kept this thought" : "💭 생각을 맡아뒀어요",
    promise:
      lang === "en"
        ? "It's saved here for now."
        : "여기에 저장해 두었어요.",
    primaryActionLabel: lang === "en" ? "Keep it here" : "그대로 맡기기",
    primaryAction: "keep_note",
    actualAction: "inbox_only",
    rediscoveryEligible: false,
  };
}

/** Guard against promise copy that overclaims system behavior. */
export function validatePromiseHonesty(card: PromiseCard): string[] {
  const issues: string[] = [];
  const blob = `${card.label} ${card.promise}`;

  if (card.actualAction !== "schedule_on_confirm" && card.scheduleCommitted) {
    issues.push("scheduleCommitted without schedule_on_confirm");
  }

  if (
    card.actualAction === "inbox_only" &&
    card.rediscoveryEligible &&
    card.primaryAction === "keep_note"
  ) {
    issues.push("rediscovery promised without archive action");
  }

  if (!card.rediscoveryEligible && /며칠|few days|revisit|꺼내/i.test(blob)) {
    issues.push("rediscovery copy without rediscoveryEligible");
  }

  if (
    card.actualAction !== "schedule_on_confirm" &&
    /다시\s*보여|show you again|알려|notify|remind/i.test(blob)
  ) {
    issues.push("resurface or notify language without schedule commit path");
  }

  if (card.actualAction === "schedule_on_confirm") {
    for (const re of FORBIDDEN_PRE_CONFIRM) {
      if (re.test(blob)) {
        issues.push(`pre-confirm overclaim: ${re.source}`);
      }
    }
    if (!card.detectedDate) {
      issues.push("schedule_on_confirm without detectedDate");
    }
  }

  if (card.primaryAction === "confirm_schedule" && !card.detectedDate) {
    issues.push("confirm_schedule without detectedDate");
  }

  if (card.primaryAction === "archive" && card.actualAction !== "archive_on_confirm") {
    issues.push("archive primary without archive_on_confirm");
  }

  return issues;
}
