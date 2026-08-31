import { track } from "@/lib/analytics";
import { parseNlTemporalModel, type NlTemporalModel } from "@/lib/nlTemporalModel";

export type TemporalShadowMismatch =
  | "none"
  | "legacy_auto_model_unresolved"
  | "legacy_clock_disagreement"
  | "legacy_block_model_resolved"
  | "legacy_date_only_model_daypart"
  | "legacy_resolved_model_none";

export type LegacyTemporalShadowDecision =
  | { ok: true; start: Date }
  | { ok: false; reason: string };

export type TemporalShadowAudit = {
  mismatch: TemporalShadowMismatch;
  legacyOutcome: "auto" | "blocked";
  legacyReason: string | null;
  legacyResolved: boolean;
  legacyHour: number | null;
  legacyMinute: number | null;
  modelPrecision: NlTemporalModel["precision"];
  modelDateKind: NlTemporalModel["date"] extends infer _T ? string | null : never;
  modelDaypart: NlTemporalModel["daypart"];
  modelResolvedTimed: boolean;
  modelHour: number | null;
  modelMinute: number | null;
  modelHasDeadline: boolean;
  modelHasRecurrence: boolean;
  modelAmbiguities: string;
};

const TEMPORAL_BLOCK_REASONS = new Set([
  "no_clock",
  "unresolved_date",
  "date_only",
  "multiple_clocks",
  "clarify_intent",
  "approximate_time",
]);

function modelClock(model: NlTemporalModel): { hour: number; minute: number } | null {
  if (model.range?.resolved && model.range.start?.kind === "exact") {
    return { hour: model.range.start.hour24, minute: model.range.start.minute };
  }
  if (model.exactClock) {
    return { hour: model.exactClock.hour24, minute: model.exactClock.minute };
  }
  return null;
}

function modelIsResolvedTimed(model: NlTemporalModel): boolean {
  if (model.ambiguities.length > 0) return false;
  if (model.deadline || model.recurrence) return false;
  if (model.relativeOffset) return true;
  if (model.range?.resolved && model.range.start?.kind === "exact") return true;
  return Boolean(model.exactClock);
}

function relativeExpectedStart(model: NlTemporalModel, now: Date): Date | null {
  const offset = model.relativeOffset;
  if (!offset) return null;
  const unitMs =
    offset.unit === "minute"
      ? 60_000
      : offset.unit === "hour"
        ? 60 * 60_000
        : 24 * 60 * 60_000;
  return new Date(now.getTime() + offset.amount * unitMs);
}

function clocksDisagree(model: NlTemporalModel, legacyResolvedStart: Date | null, now: Date): boolean {
  if (!legacyResolvedStart) return false;

  const relative = relativeExpectedStart(model, now);
  if (relative) {
    return Math.abs(relative.getTime() - legacyResolvedStart.getTime()) > 60_000;
  }

  const expected = modelClock(model);
  if (!expected) return false;
  return (
    legacyResolvedStart.getHours() !== expected.hour ||
    legacyResolvedStart.getMinutes() !== expected.minute
  );
}

export function buildTemporalShadowAudit(
  text: string,
  now: Date,
  decision: LegacyTemporalShadowDecision,
  legacyResolvedStart: Date | null,
): TemporalShadowAudit {
  const model = parseNlTemporalModel(text, now);
  const resolvedTimed = modelIsResolvedTimed(model);
  const expectedClock = modelClock(model);

  let mismatch: TemporalShadowMismatch = "none";

  if (decision.ok && !resolvedTimed) {
    mismatch = "legacy_auto_model_unresolved";
  } else if (clocksDisagree(model, legacyResolvedStart, now)) {
    mismatch = "legacy_clock_disagreement";
  } else if (
    !decision.ok &&
    resolvedTimed &&
    TEMPORAL_BLOCK_REASONS.has(decision.reason)
  ) {
    mismatch = "legacy_block_model_resolved";
  } else if (
    legacyResolvedStart &&
    model.daypart &&
    !model.exactClock &&
    !model.relativeOffset &&
    legacyResolvedStart.getHours() === 0 &&
    legacyResolvedStart.getMinutes() === 0
  ) {
    mismatch = "legacy_date_only_model_daypart";
  } else if (legacyResolvedStart && model.precision === "none") {
    mismatch = "legacy_resolved_model_none";
  }

  return {
    mismatch,
    legacyOutcome: decision.ok ? "auto" : "blocked",
    legacyReason: decision.ok ? null : decision.reason,
    legacyResolved: Boolean(legacyResolvedStart),
    legacyHour: legacyResolvedStart?.getHours() ?? null,
    legacyMinute: legacyResolvedStart?.getMinutes() ?? null,
    modelPrecision: model.precision,
    modelDateKind: model.date?.kind ?? null,
    modelDaypart: model.daypart,
    modelResolvedTimed: resolvedTimed,
    modelHour: expectedClock?.hour ?? null,
    modelMinute: expectedClock?.minute ?? null,
    modelHasDeadline: Boolean(model.deadline),
    modelHasRecurrence: Boolean(model.recurrence),
    modelAmbiguities: model.ambiguities.join(","),
  };
}

/**
 * Shadow-only observation. Never changes scheduling behavior and never sends raw text.
 * Any parser/analytics exception is swallowed so the legacy decision remains authoritative.
 */
export function observeTemporalShadow(
  text: string,
  lang: "ko" | "en",
  now: Date,
  decision: LegacyTemporalShadowDecision,
  legacyResolvedStart: Date | null,
): TemporalShadowAudit | null {
  try {
    const audit = buildTemporalShadowAudit(text, now, decision, legacyResolvedStart);
    if (audit.mismatch !== "none") {
      track("nl_temporal_shadow_mismatch", {
        lang,
        mismatch: audit.mismatch,
        legacy_outcome: audit.legacyOutcome,
        legacy_reason: audit.legacyReason ?? undefined,
        legacy_resolved: audit.legacyResolved,
        legacy_hour: audit.legacyHour ?? undefined,
        legacy_minute: audit.legacyMinute ?? undefined,
        model_precision: audit.modelPrecision,
        model_date_kind: audit.modelDateKind ?? undefined,
        model_daypart: audit.modelDaypart ?? undefined,
        model_resolved_timed: audit.modelResolvedTimed,
        model_hour: audit.modelHour ?? undefined,
        model_minute: audit.modelMinute ?? undefined,
        model_deadline: audit.modelHasDeadline,
        model_recurrence: audit.modelHasRecurrence,
        model_ambiguities: audit.modelAmbiguities || undefined,
      });
    }
    return audit;
  } catch {
    return null;
  }
}
