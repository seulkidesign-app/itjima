import {
  buildNaturalScheduleDraft,
  hasNaturalRepeatIntent,
  hasNaturalScheduleTime,
  resolveNaturalScheduleStart,
  type NaturalScheduleDraft,
} from "@/lib/naturalScheduleDraft";
import { understandNaturalLanguage } from "@/lib/nlSchedule";
import {
  countDistinctClockMentions,
  isSingleClockRange,
  scheduleConfirmationReasons,
  type ScheduleConfirmationReason,
} from "@/lib/nlScheduleSafety";
import {
  hasApproximateTimeExpression,
  hasBroadUnresolvedDatePeriod,
  hasDeadlineExpression,
  hasExpandedRepeatIntent,
  hasMixedKoreanMeridiemColon,
  hasPastDateReference,
  hasPastTimeOnlyClock,
  hasUnsupportedColonClockRange,
  hasUnsupportedDateRange,
  shouldKeepScheduleSemanticsQuiet,
} from "@/lib/nlSemanticSafety";
import type { InboxItem } from "@/lib/store";

export type AutoCommitBlockReason =
  | "empty"
  | "empty_title"
  | "no_clock"
  | "unresolved_date"
  | "date_only"
  | "multiple_clocks"
  | "repeat"
  | "clarify_intent"
  | "quiet"
  | "deadline"
  | "approximate_time"
  | ScheduleConfirmationReason;

export type TimedAutoCommitDecision =
  | { ok: true; draft: NaturalScheduleDraft }
  | { ok: false; reason: AutoCommitBlockReason };

/**
 * V02-08C: high-confidence timed capture may auto-commit only when every
 * scheduling assumption is already resolved. Prefer left-item / ambiguity UI
 * whenever anything is uncertain — never use nlIntent === schedule_exact alone.
 */
export function evaluateTimedAutoCommit(
  text: string,
  lang: "ko" | "en",
  now = new Date(),
): TimedAutoCommitDecision {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  // Semantic context wins over date/time tokens. Questions, negations,
  // tentative plans, edit replies, unsupported triggers and vague-future
  // phrases remain durable raw records instead of creating a new schedule.
  if (shouldKeepScheduleSemanticsQuiet(trimmed)) {
    return { ok: false, reason: "quiet" };
  }

  // Repetition is not implemented as a durable recurrence model yet.
  if (hasNaturalRepeatIntent(trimmed) || hasExpandedRepeatIntent(trimmed)) {
    return { ok: false, reason: "repeat" };
  }

  // A broad period plus a precise-looking clock still lacks a calendar day.
  // (Weekend / 주말 are excluded inside the guard — clarification owns them.)
  if (hasBroadUnresolvedDatePeriod(trimmed)) {
    return { ok: false, reason: "unresolved_date" };
  }

  // Fuzzy clocks ("3시쯤", "around 3pm") have no exact model yet.
  if (hasApproximateTimeExpression(trimmed)) {
    return { ok: false, reason: "approximate_time" };
  }

  // Past input may be history or a typo. Do not silently move it forward.
  if (hasPastDateReference(trimmed, now) || hasPastTimeOnlyClock(trimmed, now)) {
    return { ok: false, reason: "unresolved_date" };
  }

  // Unsupported date/range syntax must stay raw rather than truncating.
  if (hasUnsupportedDateRange(trimmed) || hasUnsupportedColonClockRange(trimmed)) {
    return { ok: false, reason: "unresolved_date" };
  }

  // `오후 03:00` previously fell through to 03:00.
  if (hasMixedKoreanMeridiemColon(trimmed)) {
    return { ok: false, reason: "unresolved_date" };
  }

  // End-only / deadline language is not a start-time schedule yet.
  if (hasDeadlineExpression(trimmed)) {
    return { ok: false, reason: "deadline" };
  }

  const safety = scheduleConfirmationReasons(trimmed, now);
  if (safety.length > 0) {
    return { ok: false, reason: safety[0] };
  }

  const clockCount = countDistinctClockMentions(trimmed);
  if (clockCount >= 2 && !isSingleClockRange(trimmed)) {
    return { ok: false, reason: "multiple_clocks" };
  }

  if (!hasNaturalScheduleTime(trimmed)) {
    return { ok: false, reason: "no_clock" };
  }

  // Bare clock count 0 is only OK for relative offsets ("30분 뒤") that still resolve.
  if (clockCount === 0) {
    const relativeOk = resolveNaturalScheduleStart(trimmed, now) !== null;
    if (!relativeOk) return { ok: false, reason: "no_clock" };
  }

  const start = resolveNaturalScheduleStart(trimmed, now);
  if (!start) return { ok: false, reason: "unresolved_date" };

  const nl = understandNaturalLanguage(trimmed, lang);
  if (nl.intent === "schedule_clarify") {
    return { ok: false, reason: "clarify_intent" };
  }
  // Quiet / sensitive / low-confidence notes stay as left items.
  if (
    nl.confidence === "low" &&
    nl.intent !== "schedule_exact" &&
    !hasNaturalScheduleTime(trimmed)
  ) {
    return { ok: false, reason: "quiet" };
  }

  const draft = buildNaturalScheduleDraft({
    id: "auto-commit-eval",
    text: trimmed,
    images: [],
    created_at: now.toISOString(),
  } satisfies InboxItem);

  if (!draft.text.trim()) return { ok: false, reason: "empty_title" };
  // Timed auto-commit requires a real clock, not a silent all-day promotion.
  if (draft.options.allDay) return { ok: false, reason: "date_only" };

  return { ok: true, draft };
}

export function canAutoCommitTimedCapture(
  text: string,
  lang: "ko" | "en",
  now = new Date(),
): boolean {
  return evaluateTimedAutoCommit(text, lang, now).ok;
}
