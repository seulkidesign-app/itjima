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
  scheduleConfirmationReasons,
  type ScheduleConfirmationReason,
} from "@/lib/nlScheduleSafety";
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
  if (hasNaturalRepeatIntent(trimmed)) {
    return { ok: false, reason: "repeat" };
  }

  const safety = scheduleConfirmationReasons(trimmed, now);
  if (safety.length > 0) {
    return { ok: false, reason: safety[0] };
  }

  const clockCount = countDistinctClockMentions(trimmed);
  if (clockCount >= 2) return { ok: false, reason: "multiple_clocks" };

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
