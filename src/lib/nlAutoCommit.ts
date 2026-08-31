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
import { normalizeKoreanClockWordsForParsing } from "@/lib/nlKoreanTemporalNormalization";
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
  // Parsing-only normalization: the user's original record is untouched, while
  // every existing deterministic safety gate sees the same numeric clock shape.
  const trimmed = normalizeKoreanClockWordsForParsing(text.trim());

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

  const adversarialReason = adversarialScheduleReason(trimmed);
  if (adversarialReason) {
    return finish({ ok: false, reason: adversarialReason });
  }

  if (shouldKeepScheduleSemanticsQuiet(trimmed)) {
    return finish({ ok: false, reason: "quiet" });
  }

  if (hasNaturalRepeatIntent(trimmed) || hasExpandedRepeatIntent(trimmed)) {
    return finish({ ok: false, reason: "repeat" });
  }

  if (hasBroadUnresolvedDatePeriod(trimmed)) {
    return finish({ ok: false, reason: "unresolved_date" });
  }

  if (hasApproximateTimeExpression(trimmed)) {
    return finish({ ok: false, reason: "approximate_time" });
  }

  if (hasPastDateReference(trimmed, now) || hasPastTimeOnlyClock(trimmed, now)) {
    return finish({ ok: false, reason: "unresolved_date" });
  }

  if (hasUnsupportedDateRange(trimmed) || hasUnsupportedColonClockRange(trimmed)) {
    return finish({ ok: false, reason: "unresolved_date" });
  }

  if (hasMixedKoreanMeridiemColon(trimmed)) {
    return finish({ ok: false, reason: "unresolved_date" });
  }

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
  if (
    nl.confidence === "low" &&
    nl.intent !== "schedule_exact" &&
    !hasNaturalScheduleTime(trimmed)
  ) {
    return finish({ ok: false, reason: "quiet" });
  }

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
  if (draft.options.allDay) return finish({ ok: false, reason: "date_only" });

  return finish({ ok: true, draft });
}

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
