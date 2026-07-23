import { detectDate } from "@/lib/dateDetect";
import { classifyLocally } from "@/lib/localClassifier";
import { analyzeThought, type ThoughtCategory } from "@/lib/ruleEngine";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { formatSuggestedMoment } from "@/lib/scheduleChoices";

export type PromisePrimaryAction =
  | "confirm_schedule"
  | "set_resurface"
  | "keep_task"
  | "archive"
  | "keep_note";

export type PromiseEditAction = "open_schedule_sheet" | "open_edit_menu";

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
  rediscoveryEligible: boolean;
  scheduleCommitted: boolean;
};

const IDEA_CATEGORIES = new Set<ThoughtCategory>([
  "idea",
  "note",
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

function vaultHint(lang: "ko" | "en"): string {
  return lang === "en"
    ? "You can find it anytime in your vault."
    : "생각 보관함에서 언제든 찾을 수 있어요.";
}

function shortTopic(text: string): string {
  const line = thoughtFirstLine(text);
  if (line.length <= 16) return line;
  return `${line.slice(0, 14).trim()}…`;
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
    const moment = formatSuggestedMoment(dateHit.start, lang);
    return {
      ...base,
      icon: "📅",
      label:
        lang === "en"
          ? `${moment} looks like a schedule`
          : `${moment} 일정 같아요`,
      promise: lang === "en" ? "Add it to your schedule?" : "일정으로 잡을까요?",
      primaryActionLabel: lang === "en" ? "Add to schedule" : "일정으로 잡기",
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
      label: lang === "en" ? "Keeping this as a task" : "할 일로 맡아뒀어요",
      promise:
        lang === "en"
          ? "Set a time whenever you're ready."
          : "시간은 나중에 정해도 괜찮아요.",
      primaryActionLabel:
        lang === "en" ? "Pick when to revisit" : "다시 볼 시점 정하기",
      primaryAction: "set_resurface",
      editAction: "open_schedule_sheet",
      actualAction: "inbox_only",
      rediscoveryEligible: false,
    };
  }

  if (category === "link") {
    return {
      ...base,
      icon: "🔗",
      label: lang === "en" ? "Saved as a link" : "링크로 맡아뒀어요",
      promise: vaultHint(lang),
      primaryActionLabel: lang === "en" ? "Keep here" : "그대로 두기",
      primaryAction: "keep_note",
      actualAction: "inbox_only",
      rediscoveryEligible: false,
    };
  }

  if (category === "shopping") {
    return {
      ...base,
      icon: "🛒",
      label: lang === "en" ? "Saved to pick up later" : "장보기로 맡아뒀어요",
      promise: vaultHint(lang),
      primaryActionLabel:
        lang === "en" ? "Pick when to revisit" : "다시 볼 시점 정하기",
      primaryAction: "set_resurface",
      editAction: "open_schedule_sheet",
      actualAction: "inbox_only",
      rediscoveryEligible: false,
    };
  }

  if (
    IDEA_CATEGORIES.has(category) &&
    confidence >= 0.65 &&
    !analysis.isJunk
  ) {
    const topic = shortTopic(trimmed);
    return {
      ...base,
      icon: "💭",
      label:
        lang === "en"
          ? `Saved "${topic}" as an idea`
          : `${topic} 아이디어로 맡아뒀어요`,
      promise: vaultHint(lang),
      primaryActionLabel:
        lang === "en" ? "Pick when to revisit" : "다시 볼 시점 정하기",
      primaryAction: "set_resurface",
      editAction: "open_schedule_sheet",
      actualAction: "inbox_only",
      rediscoveryEligible: true,
    };
  }

  return {
    ...base,
    icon: "✓",
    label: lang === "en" ? "Saved for you" : "맡아뒀어요",
    promise: vaultHint(lang),
    primaryActionLabel: lang === "en" ? "Keep here" : "그대로 두기",
    primaryAction: "keep_note",
    actualAction: "inbox_only",
    rediscoveryEligible: false,
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
