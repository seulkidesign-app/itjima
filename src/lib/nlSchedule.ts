import { detectDate, isRelativeDateReference } from "@/lib/dateDetect";
import { classifyLocally } from "@/lib/localClassifier";
import { analyzeThought, type ThoughtCategory } from "@/lib/ruleEngine";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { formatSuggestedMoment } from "@/lib/scheduleChoices";

export type ScheduleConfidence = "high" | "low";

export type NlIntent =
  | "schedule_exact"
  | "schedule_clarify"
  | "task"
  | "archive"
  | "keep";

export type NlScheduleUnderstanding = {
  intent: NlIntent;
  confidence: ScheduleConfidence;
  category: ThoughtCategory;
  /** Parsed moment when intent is schedule_exact */
  detectedDate: { label: string; start: Date; end: Date } | null;
  hasExplicitTime: boolean;
  /** Human-readable mirror line */
  mirrorLine: string;
  mirrorDetail: string;
  primaryLabelKo: string;
  primaryLabelEn: string;
  /** What is missing for clarify flow */
  clarifyMissing?: "time" | "day";
};

const TIME_RE =
  /(?:\d{1,2}\s*시|\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm)\b|오전|오후)/i;

const VAGUE_WHEN_RE =
  /(?:쯤|정도|무렵|경|around|about|or\s+so|sometime|roughly)/i;

const REFERENCE_RE =
  /(?:번호|number|#|비밀번호|password|pin\s*code|여권|passport|account|계좌|카드\s*번호)/i;

const TASK_VERB_RE =
  /(?:하기|하자|해야|전화|연락|call|email|send|submit|buy|사기|구매|회의|미팅|병원|치과|dentist|appointment)/i;

const WATCH_READ_RE =
  /(?:보기|읽기|read|watch|see|볼\s)/i;

function hasExplicitTime(text: string): boolean {
  const det = detectDate(text);
  if (!det) return false;
  return TIME_RE.test(text);
}

function isReferenceNote(text: string, category: ThoughtCategory): boolean {
  const trimmed = text.trim();
  if (REFERENCE_RE.test(trimmed)) return true;
  return false;
}

function isTaskWithoutSchedule(text: string, category: ThoughtCategory): boolean {
  if (category === "task" || category === "reminder") return true;
  if (TASK_VERB_RE.test(text) && !detectDate(text)) return true;
  return false;
}

/** Low-confidence schedule: date-ish language but vague or missing time. */
function isClarifySchedule(text: string): boolean {
  if (VAGUE_WHEN_RE.test(text)) return true;
  const det = detectDate(text);
  if (!det) {
    if (isRelativeDateReference(text) && WATCH_READ_RE.test(text)) return true;
    if (/다음\s*주|next\s+week/i.test(text) && !TIME_RE.test(text)) return true;
    return false;
  }
  if (!hasExplicitTime(text) && /(?:다음\s*주|next\s+week|주말|weekend)/i.test(text)) {
    return true;
  }
  return false;
}

export function understandNaturalLanguage(
  text: string,
  lang: "ko" | "en",
): NlScheduleUnderstanding {
  const trimmed = text.trim();
  const analysis = analyzeThought(trimmed);
  const resolution = classifyLocally(trimmed);
  const category =
    resolution?.category ??
    analysis.category ??
    (detectDate(trimmed) ? "schedule" : "note");
  const dateHit = detectDate(trimmed);
  const topic = thoughtFirstLine(trimmed);

  if (analysis.isJunk) {
    return {
      intent: "keep",
      confidence: "low",
      category,
      detectedDate: null,
      hasExplicitTime: false,
      mirrorLine: lang === "en" ? "Saved for you" : "맡아뒀어요",
      mirrorDetail:
        lang === "en" ? "Keep it here for now." : "일단 여기에 둘게요.",
      primaryLabelKo: "그대로 두기",
      primaryLabelEn: "Keep here",
    };
  }

  if (isReferenceNote(trimmed, category)) {
    return {
      intent: "archive",
      confidence: "high",
      category,
      detectedDate: null,
      hasExplicitTime: false,
      mirrorLine:
        lang === "en" ? "Looks like something to store" : "보관하면 좋을 것 같아요",
      mirrorDetail:
        lang === "en"
          ? "Reference notes belong in your vault."
          : "번호·메모는 보관함에 두면 찾기 쉬워요.",
      primaryLabelKo: "보관함에 맡기기",
      primaryLabelEn: "Save to vault",
    };
  }

  if (dateHit && !isClarifySchedule(trimmed) && hasExplicitTime(trimmed)) {
    const moment = formatSuggestedMoment(dateHit.start, lang);
    return {
      intent: "schedule_exact",
      confidence: "high",
      category: "schedule",
      detectedDate: dateHit,
      hasExplicitTime: true,
      mirrorLine:
        lang === "en"
          ? `${moment} · ${topic}`
          : `${moment} · ${topic}`,
      mirrorDetail:
        lang === "en"
          ? "One tap to add it — no calendar needed."
          : "한 번만 확인하면 돼요 — 달력은 필요 없어요.",
      primaryLabelKo: "맞아요",
      primaryLabelEn: "That's right",
    };
  }

  if (dateHit && !isClarifySchedule(trimmed)) {
    const moment = formatSuggestedMoment(dateHit.start, lang);
    return {
      intent: "schedule_exact",
      confidence: "high",
      category: "schedule",
      detectedDate: dateHit,
      hasExplicitTime: false,
      mirrorLine:
        lang === "en" ? `${moment} · ${topic}` : `${moment} · ${topic}`,
      mirrorDetail:
        lang === "en"
          ? "Defaults to 9:00 — adjust only if you want."
          : "시간은 9시로 잡을게요 — 바꾸고 싶을 때만 수정해요.",
      primaryLabelKo: "맞아요",
      primaryLabelEn: "That's right",
    };
  }

  if (isClarifySchedule(trimmed) || (dateHit && isClarifySchedule(trimmed))) {
    return {
      intent: "schedule_clarify",
      confidence: "low",
      category: "schedule",
      detectedDate: dateHit,
      hasExplicitTime: hasExplicitTime(trimmed),
      clarifyMissing: TIME_RE.test(trimmed) ? "day" : "time",
      mirrorLine:
        lang === "en" ? "When should we bring it back?" : "언제쯤 보면 좋을까요?",
      mirrorDetail:
        lang === "en"
          ? "Pick roughly — no calendar yet."
          : "대략만 골라 주세요 — 달력은 나중에 열 수 있어요.",
      primaryLabelKo: "이번 주말",
      primaryLabelEn: "This weekend",
    };
  }

  if (isTaskWithoutSchedule(trimmed, category)) {
    return {
      intent: "task",
      confidence: "high",
      category: category === "reminder" ? "reminder" : "task",
      detectedDate: null,
      hasExplicitTime: false,
      mirrorLine:
        lang === "en" ? `Task · ${topic}` : `할 일 · ${topic}`,
      mirrorDetail:
        lang === "en"
          ? "Add to Schedule without picking a date yet."
          : "날짜 없이 일정에 넣을 수 있어요.",
      primaryLabelKo: "할 일로 넣기",
      primaryLabelEn: "Add as task",
    };
  }

  return {
    intent: "keep",
    confidence: "low",
    category,
    detectedDate: null,
    hasExplicitTime: false,
    mirrorLine: lang === "en" ? "Saved for you" : "맡아뒀어요",
    mirrorDetail:
      lang === "en" ? "Keep it here for now." : "일단 여기에 둘게요.",
    primaryLabelKo: "그대로 두기",
    primaryLabelEn: "Keep here",
  };
}

export type ClarifyPick = "today" | "tomorrow" | "weekend" | "next_week";

const CLARIFY_LABELS: Record<
  ClarifyPick,
  { ko: string; en: string }
> = {
  today: { ko: "오늘", en: "Today" },
  tomorrow: { ko: "내일", en: "Tomorrow" },
  weekend: { ko: "이번 주말", en: "This weekend" },
  next_week: { ko: "다음 주", en: "Next week" },
};

/** Chips shown for low-confidence schedule — only missing info, no calendar. */
export function clarifyPicksForText(
  text: string,
  lang: "ko" | "en",
): { pick: ClarifyPick; label: string }[] {
  const picks: ClarifyPick[] = /다음\s*주|next\s+week/i.test(text)
    ? ["next_week", "weekend", "tomorrow"]
    : ["today", "tomorrow", "weekend"];

  return picks.map((pick) => ({
    pick,
    label: lang === "en" ? CLARIFY_LABELS[pick].en : CLARIFY_LABELS[pick].ko,
  }));
}

export function dateFromClarifyPick(
  pick: ClarifyPick,
  now = new Date(),
): { start: Date; end: Date; label: string } {
  const start = new Date(now);
  start.setHours(9, 0, 0, 0);

  if (pick === "tomorrow") {
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    return { start, end, label: "내일" };
  }

  if (pick === "next_week") {
    start.setDate(start.getDate() + 7);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    return { start, end, label: "다음 주" };
  }

  if (pick === "weekend") {
    const day = start.getDay();
    const toSat = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
    start.setDate(start.getDate() + toSat);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    return { start, end, label: "이번 주말" };
  }

  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  return { start, end, label: "오늘" };
}
