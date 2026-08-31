import {
  parseNlTemporalModel,
  type NlTemporalModel,
} from "@/lib/nlTemporalModel";

export type TemporalDecisionGateReason =
  | "ambiguity"
  | "deadline"
  | "recurrence"
  | "no_resolved_clock"
  | "unsafe_range";

export type TemporalDecisionGateResult =
  | { ok: true; precision: "exact_clock" | "relative_offset" | "range" }
  | {
      ok: false;
      reason: TemporalDecisionGateReason;
      precision: NlTemporalModel["precision"];
    };

function resolvedRangeIsSafe(model: NlTemporalModel): boolean {
  const range = model.range;
  if (!range?.supportedSyntax || !range.resolved) return false;
  if (range.start?.kind !== "exact" || range.end?.kind !== "exact") return false;

  const startMinutes = range.start.hour24 * 60 + range.start.minute;
  const endMinutes = range.end.hour24 * 60 + range.end.minute;
  return endMinutes > startMinutes;
}

/**
 * P0-H: fail-closed permission only.
 *
 * The canonical model does not create the persisted Date yet. Legacy resolution
 * remains responsible for the actual timestamp; this gate only refuses timed
 * auto-commit when canonical temporal semantics are not fully resolved.
 */
export function evaluateTemporalDecisionGate(
  text: string,
  now = new Date(),
): TemporalDecisionGateResult {
  const model = parseNlTemporalModel(text, now);

  if (model.ambiguities.length > 0) {
    return { ok: false, reason: "ambiguity", precision: model.precision };
  }
  if (model.deadline) {
    return { ok: false, reason: "deadline", precision: model.precision };
  }
  if (model.recurrence) {
    return { ok: false, reason: "recurrence", precision: model.precision };
  }
  if (model.relativeOffset) {
    return { ok: true, precision: "relative_offset" };
  }
  if (model.range) {
    if (resolvedRangeIsSafe(model)) return { ok: true, precision: "range" };
    return { ok: false, reason: "unsafe_range", precision: model.precision };
  }
  if (model.exactClock) {
    return { ok: true, precision: "exact_clock" };
  }

  return {
    ok: false,
    reason: "no_resolved_clock",
    precision: model.precision,
  };
}
