import {
  buildNaturalScheduleDraft,
  hasNaturalRepeatIntent,
  hasNaturalScheduleTime,
  resolveNaturalScheduleStart,
  type NaturalScheduleDraft,
} from "@/lib/naturalScheduleDraft";
import {
  adversarialScheduleReason,
  type AdversarialScheduleReason,
} from "@/lib/nlAdversarialSafety";
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
import { applyCanonicalTemporalAuthority } from "@/lib/nlTemporalAuthority";
import { evaluateTemporalDecisionGate } from "@/lib/nlTemporalDecisionGate";
import { observeTemporalShadow } from "@/lib/nlTemporalShadow";
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
  | "temporal_model_unresolved"
  | AdversarialScheduleReason
  | ScheduleConfirmationReason;

export type TimedAutoCommitDecision =
  | { ok: true; draft: NaturalScheduleDraft }
  | { ok: false; reason: AutoCommitBlockReason };

/**
 * Legacy timed decision preserved as an explicit audit baseline. It still owns
 * all historical parser/safety behavior, but callers should use
 * evaluateTimedAutoCommit() for production so Canonical timestamp authority is
 * applied after this decision succeeds.
 */
export function evaluateLegacyTimedAutoCommit(
  text: string,
  lang: "ko" | "en",
  now = new Date(),
): TimedAutoCommitDecision {
  const trimmed = text.trim();

  // P0-E shadow integration intentionally observes the legacy decision so the
  // migration audits remain meaningful after Canonical timestamp promotion.
  const finish = (decision: TimedAutoCommitDecision): TimedAutoCommitDecision => {
    try {
      const legacyResolvedStart = trimmed
        ? resolveNaturalScheduleStart(trimmed, now)
        : null;
      observeTemporalShadow(
        trimmed,
        lang,
        now,
        decision.ok
          ? { ok: true, start: decision.draft.start }
          : { ok: false, reason: decision.reason },
        legacyResolvedStart,
      );
    } catch {
      // Shadow observation is deliberately non-authoritative.
    }
    return decision;
  };

  if (!trimmed) return finish({ ok: false, reason: "empty" });

  // Fail closed on malformed/contradictory inputs before any parser can clamp,
  // truncate, or attach a clock to the wrong semantic unit.
  const adversarialReason = adversarialScheduleReason(trimmed);
  if (adversarialReason) {
    return finish({ ok: false, reason: adversarialReason });
  }

  // Semantic context wins over date/time tokens. Questions, negations,
  // tentative plans, edit replies, unsupported triggers and vague-future
  // phrases remain durable raw records instead of creating a new schedule.
  if (shouldKeepScheduleSemanticsQuiet(trimmed)) {
    return finish({ ok: false, reason: "quiet" });
  }

  // Repetition is not implemented as a durable recurrence model yet.
  if (hasNaturalRepeatIntent(trimmed) || hasExpandedRepeatIntent(trimmed)) {
    return finish({ ok: false, reason: "repeat" });
  }

  // A broad period plus a precise-looking clock still lacks a calendar day.
  // (Weekend / 주말 are excluded inside the guard — clarification owns them.)
  if (hasBroadUnresolvedDatePeriod(trimmed)) {
    return finish({ ok: false, reason: "unresolved_date" });
  }

  // Fuzzy clocks ("3시쯤", "around 3pm") have no exact model yet.
  if (hasApproximateTimeExpression(trimmed)) {
    return finish({ ok: false, reason: "approximate_time" });
  }

  // Past input may be history or a typo. Do not silently move it forward.
  if (hasPastDateReference(trimmed, now) || hasPastTimeOnlyClock(trimmed, now)) {
    return finish({ ok: false, reason: "unresolved_date" });
  }

  // Unsupported date/range syntax must stay raw rather than truncating.
  if (hasUnsupportedDateRange(trimmed) || hasUnsupportedColonClockRange(trimmed)) {
    return finish({ ok: false, reason: "unresolved_date" });
  }

  // `오후 03:00` previously fell through to 03:00.
  if (hasMixedKoreanMeridiemColon(trimmed)) {
    return finish({ ok: false, reason: "unresolved_date" });
  }

  // End-only / deadline language is not a start-time schedule yet.
  if (hasDeadlineExpression(trimmed)) {
    return finish({ ok: false, reason: "deadline" });
  }

  const safety = scheduleConfirmationReasons(trimmed, now);
  if (safety.length > 0) {
    return finish({ ok: false, reason: safety[0] });
  }

  const clockCount = countDistinctClockMentions(trimmed);
  if (clockCount >= 2 && !isSingleClockRange(trimmed)) {
    return finish({ ok: false, reason: "multiple_clocks" });
  }

  if (!hasNaturalScheduleTime(trimmed)) {
    return finish({ ok: false, reason: "no_clock" });
  }

  // Bare clock count 0 is only OK for relative offsets ("30분 뒤") that still resolve.
  if (clockCount === 0) {
    const relativeOk = resolveNaturalScheduleStart(trimmed, now) !== null;
    if (!relativeOk) return finish({ ok: false, reason: "no_clock" });
  }

  const start = resolveNaturalScheduleStart(trimmed, now);
  if (!start) return finish({ ok: false, reason: "unresolved_date" });

  const nl = understandNaturalLanguage(trimmed, lang);
  if (nl.intent === "schedule_clarify") {
    return finish({ ok: false, reason: "clarify_intent" });
  }
  // Quiet / sensitive / low-confidence notes stay as left items.
  if (
    nl.confidence === "low" &&
    nl.intent !== "schedule_exact" &&
    !hasNaturalScheduleTime(trimmed)
  ) {
    return finish({ ok: false, reason: "quiet" });
  }

  // P0-H: a timed auto-commit needs explicit permission from the canonical
  // Temporal Model as a second, fail-closed semantic gate.
  const temporalGate = evaluateTemporalDecisionGate(trimmed, now);
  if (!temporalGate.ok) {
    return finish({ ok: false, reason: "temporal_model_unresolved" });
  }

  const draft = buildNaturalScheduleDraft({
    id: "auto-commit-eval",
    text: trimmed,
    images: [],
    created_at: now.toISOString(),
  } satisfies InboxItem);

  if (!draft.text.trim()) return finish({ ok: false, reason: "empty_title" });
  // Timed auto-commit requires a real clock, not a silent all-day promotion.
  if (draft.options.allDay) return finish({ ok: false, reason: "date_only" });

  return finish({ ok: true, draft });
}

/**
 * P0-K: production timestamp authority. Legacy remains the safety/parser
 * baseline, but once it accepts a timed capture the Canonical Temporal Model
 * supplies the persisted start timestamp (and both ends for explicit ranges).
 * If Canonical cannot resolve the same capture, fail closed.
 */
export function evaluateTimedAutoCommit(
  text: string,
  lang: "ko" | "en",
  now = new Date(),
): TimedAutoCommitDecision {
  const legacy = evaluateLegacyTimedAutoCommit(text, lang, now);
  if (!legacy.ok) return legacy;

  const canonicalDraft = applyCanonicalTemporalAuthority(
    text.trim(),
    legacy.draft,
    now,
  );
  if (!canonicalDraft) {
    return { ok: false, reason: "temporal_model_unresolved" };
  }

  return { ok: true, draft: canonicalDraft };
}

export function canAutoCommitTimedCapture(
  text: string,
  lang: "ko" | "en",
  now = new Date(),
): boolean {
  return evaluateTimedAutoCommit(text, lang, now).ok;
}
