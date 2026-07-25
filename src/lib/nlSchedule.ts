import { detectDate, isAbsoluteDateReference, isRelativeDateReference } from "@/lib/dateDetect";
import { classifyLocally } from "@/lib/localClassifier";
import { analyzeThought, type ThoughtCategory } from "@/lib/ruleEngine";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { formatSuggestedMoment } from "@/lib/scheduleChoices";

/** high = one-tap card · medium = one missing-field question · low = keep in inbox */
export type ScheduleConfidence = "high" | "medium" | "low";

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
  detectedDate: { label: string; start: Date; end: Date } | null;
  hasExplicitTime: boolean;
  mirrorLine: string;
  mirrorDetail: string;
  primaryLabelKo: string;
  primaryLabelEn: string;
  clarifyMissing?: "time" | "day";
  /** Likely passport, ID, card, or password — show privacy note before archive */
  isSensitive: boolean;
  /** Date parse looked possible but failed on confirm */
  parseFailed?: boolean;
};

const TIME_RE =
  /(?:\d{1,2}\s*시|\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm)\b|오전|오후|저녁|아침|점심|\bevening\b|\bmorning\b|\bafternoon\b)/i;

const VAGUE_WHEN_RE =
  /(?:쯤|정도|무렵|경|\baround\b|\babout\b|\bor\s+so\b|\bsometime\b|\broughly\b)/i;

const REFERENCE_RE =
  /(?:번호|number|#|비밀번호|password|pin\s*code|여권|passport|account|계좌|카드\s*번호)/i;

const SENSITIVE_RE =
  /(?:여권|passport|주민\s*등록|resident\s*registration|비밀번호|password|pin\s*code|카드\s*번호|card\s*number|\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b|\b\d{6}[\s-]?\d{7}\b)/i;

const TASK_VERB_RE =
  /(?:하기|하자|해야|돌리기|갱신|알아보|제출|정리|청소|전화|연락|보내|call|email|send|submit|buy|사기|구매|회의(?:하기|잡)?|미팅)/i;

const TASK_ACTION_RE =
  /(?:하기|하자|해야|돌리기|갱신(?:하기)?|알아보(?:기)?|제출(?:하기)?|전화(?:하기)?|연락(?:하기)?|보내(?:기)?|call|submit|send)/i;

const MEETING_RE = /(?:만나|약속|미팅|회의|meet|appointment)/i;

const WATCH_READ_RE =
  /(?:보기|읽기|\bread\b|\bwatch\b|\bsee\b|볼\s)/i;

const NEXT_MONTH_EARLY_RE = /다음\s*달\s*초|early\s+next\s+month/i;

const WEEKDAY_IN_TEXT_RE =
  /(일|월|화|수|목|금|토)요일|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

const JOURNAL_ONLY_RE =
  /(?:날씨|좋았|피곤|커피|기억하고|마셨|그냥|요즘|회고|떠올|하루였|기분)/i;

function isJournalOnly(text: string): boolean {
  if (/(?:오늘|today)/i.test(text)) {
    if (
      /(?:있었|했었|였다|했는데|갔는데|힘들|좋았|피곤|마셨|날씨|회고|하루)/i.test(
        text,
      ) &&
      !/(?:내일|모레|다음|\d+\s*시|하기|하자|해야|퇴근\s*후)/i.test(text)
    ) {
      return true;
    }
    if (
      /(?:날씨|좋았|피곤|커피|기억하고|마셨|그냥|요즘|회고|떠올|하루였|기분)/i.test(
        text,
      )
    ) {
      if (
        !/(?:약속|미팅|회의|치과|병원|장보|전화|하기|하자|해야|퇴근\s*후)/i.test(
          text,
        )
      ) {
        return true;
      }
    }
  }
  if (
    /(?:내일|모레)/i.test(text) &&
    /(?:날씨|비\s|온대|춥|덥|맑)/i.test(text) &&
    !/(?:약속|미팅|회의|치과|하기|하자|전화|장보|만나)/i.test(text)
  ) {
    return true;
  }
  return false;
}

export function isSensitiveContent(text: string): boolean {
  return SENSITIVE_RE.test(text.trim());
}

function hasExplicitTime(text: string): boolean {
  if (!detectDate(text)) return false;
  return TIME_RE.test(text);
}

function isReferenceNote(text: string): boolean {
  if (/https?:\/\//i.test(text.trim())) return true;
  if (/(?:나중에\s*읽|참고할\s*링크|read\s*later)/i.test(text.trim())) return true;
  if (
    TASK_ACTION_RE.test(text) &&
    !/(?:번호|비밀번호|password|pin\s*code)/i.test(text)
  ) {
    return false;
  }
  if (REFERENCE_RE.test(text.trim())) return true;
  if (isSensitiveContent(text) && !TASK_ACTION_RE.test(text)) return true;
  return false;
}

function isTaskWithoutSchedule(text: string, category: ThoughtCategory): boolean {
  const trimmed = text.trim();
  if (/^메모:/i.test(trimmed)) return false;
  if (/^회의실/i.test(trimmed)) return false;
  if (category === "task" || category === "reminder") return true;
  if (/(?:하기|하자|해야)\s*$/i.test(trimmed)) return true;
  if (TASK_VERB_RE.test(trimmed) && !detectDate(trimmed)) return true;
  return false;
}

function hasDateAnchor(text: string): boolean {
  return (
    isRelativeDateReference(text) ||
    isAbsoluteDateReference(text) ||
    /다음\s*달\s*\d{1,2}\s*일/.test(text)
  );
}

function isTimeOnlyPhrase(text: string): boolean {
  const trimmed = text.trim();
  if (!TIME_RE.test(trimmed) || hasDateAnchor(trimmed)) return false;
  const stripped = trimmed
    .replace(/(?:오전|오후)?\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/g, "")
    .trim();
  return stripped.length <= 1;
}

function isClarifySchedule(text: string): boolean {
  if (NEXT_MONTH_EARLY_RE.test(text)) return true;
  if (/이번\s*주\s*안/i.test(text)) return true;
  if (
    /(?:주말|weekend)/i.test(text) &&
    MEETING_RE.test(text) &&
    !hasExplicitTime(text)
  ) {
    return true;
  }
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
  if (!hasExplicitTime(text) && WEEKDAY_IN_TEXT_RE.test(text) && /약속|미팅|meeting|appointment/i.test(text)) {
    return false;
  }
  return false;
}

function schedulePrimaryLabels(lang: "ko" | "en"): { ko: string; en: string } {
  return lang === "en"
    ? { ko: "일정에 추가", en: "Add to schedule" }
    : { ko: "일정에 추가", en: "Add to schedule" };
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
  const sensitive = isSensitiveContent(trimmed);
  const scheduleLabels = schedulePrimaryLabels(lang);

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
      isSensitive: false,
    };
  }

  if (isJournalOnly(trimmed)) {
    return {
      intent: "keep",
      confidence: "low",
      category: "note",
      detectedDate: null,
      hasExplicitTime: false,
      mirrorLine: lang === "en" ? "Saved for you" : "맡아뒀어요",
      mirrorDetail:
        lang === "en" ? "Keep it here for now." : "일단 여기에 둘게요.",
      primaryLabelKo: "그대로 두기",
      primaryLabelEn: "Keep here",
      isSensitive: false,
    };
  }

  if (dateHit && !isClarifySchedule(trimmed) && !isTimeOnlyPhrase(trimmed)) {
    const moment = formatSuggestedMoment(dateHit.start, lang);
    const explicit = hasExplicitTime(trimmed);
    return {
      intent: "schedule_exact",
      confidence: "high",
      category: "schedule",
      detectedDate: dateHit,
      hasExplicitTime: explicit,
      mirrorLine: `${moment} · ${topic}`,
      mirrorDetail: explicit
        ? lang === "en"
          ? "Tap to add — calendar only if you want to change it."
          : "한 번 누르면 일정에 들어가요 — 바꾸고 싶을 때만 날짜를 고르면 돼요."
        : lang === "en"
          ? "Defaults to 9:00 — change only if you want."
          : "시간은 9시로 잡을게요 — 바꾸고 싶을 때만 수정해요.",
      primaryLabelKo: scheduleLabels.ko,
      primaryLabelEn: scheduleLabels.en,
      isSensitive: false,
    };
  }

  if (isClarifySchedule(trimmed)) {
    const missing = TIME_RE.test(trimmed) ? "day" : "time";
    return {
      intent: "schedule_clarify",
      confidence: "medium",
      category: "schedule",
      detectedDate: dateHit,
      hasExplicitTime: hasExplicitTime(trimmed),
      clarifyMissing: missing,
      mirrorLine:
        missing === "day"
          ? lang === "en"
            ? "Which day works?"
            : "며칠쯤이 좋을까요?"
          : lang === "en"
            ? "When should we bring it back?"
            : "언제쯤 보면 좋을까요?",
      mirrorDetail:
        lang === "en"
          ? "Pick one — or choose a date yourself."
          : "하나만 골라 주세요 — 필요하면 날짜를 직접 고를 수 있어요.",
      primaryLabelKo: "날짜 고르기",
      primaryLabelEn: "Pick a date",
      isSensitive: false,
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
          ? "Add as a task now — add a date only if you want."
          : "날짜 없이 할 일로 넣을 수 있어요.",
      primaryLabelKo: "할 일로 넣기",
      primaryLabelEn: "Add as task",
      isSensitive: false,
    };
  }

  if (isReferenceNote(trimmed)) {
    return {
      intent: "archive",
      confidence: "high",
      category,
      detectedDate: null,
      hasExplicitTime: false,
      mirrorLine:
        lang === "en" ? "Looks like something to store" : "보관하면 좋을 것 같아요",
      mirrorDetail: sensitive
        ? lang === "en"
          ? "Sensitive info stays on your device only."
          : "민감한 내용은 기기에만 남아요. 다른 곳으로 보내지 않아요."
        : lang === "en"
          ? "Reference notes belong in your vault."
          : "번호·메모는 보관함에 두면 찾기 쉬워요.",
      primaryLabelKo: "보관함에 맡기기",
      primaryLabelEn: "Save to vault",
      isSensitive: sensitive,
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
    isSensitive: false,
  };
}

export type ClarifyPick =
  | "today"
  | "tomorrow"
  | "weekend"
  | "next_week"
  | "early_next_month"
  | "next_month_seventh";

const CLARIFY_LABELS: Record<
  ClarifyPick,
  { ko: string; en: string }
> = {
  today: { ko: "오늘", en: "Today" },
  tomorrow: { ko: "내일", en: "Tomorrow" },
  weekend: { ko: "이번 주말", en: "This weekend" },
  next_week: { ko: "다음 주", en: "Next week" },
  early_next_month: { ko: "다음 달 1일", en: "1st next month" },
  next_month_seventh: { ko: "다음 달 7일", en: "7th next month" },
};

/** Up to 3 contextual chips — no calendar until explicit fallback. */
export function clarifyPicksForText(
  text: string,
  lang: "ko" | "en",
): { pick: ClarifyPick; label: string }[] {
  let picks: ClarifyPick[];

  if (NEXT_MONTH_EARLY_RE.test(text)) {
    picks = ["early_next_month", "next_month_seventh", "weekend"];
  } else if (/다음\s*주|next\s+week/i.test(text)) {
    picks = ["next_week", "weekend", "tomorrow"];
  } else if (WEEKDAY_IN_TEXT_RE.test(text)) {
    picks = ["tomorrow", "weekend", "next_week"];
  } else if (VAGUE_WHEN_RE.test(text)) {
    picks = ["tomorrow", "weekend", "next_week"];
  } else {
    picks = ["today", "tomorrow", "weekend"];
  }

  return picks.slice(0, 3).map((pick) => ({
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

  if (pick === "early_next_month") {
    start.setMonth(start.getMonth() + 1, 1);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    return { start, end, label: "다음 달 1일" };
  }

  if (pick === "next_month_seventh") {
    start.setMonth(start.getMonth() + 1, 7);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    return { start, end, label: "다음 달 7일" };
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

/** Whether inline Brain Mirror should appear (high/medium only). */
export function shouldShowNlPrompt(text: string, lang: "ko" | "en"): boolean {
  const nl = understandNaturalLanguage(text.trim(), lang);
  return nl.confidence !== "low" && nl.intent !== "keep";
}
