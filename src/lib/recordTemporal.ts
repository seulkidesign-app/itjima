import type { AutoCommitBlockReason } from "@/lib/nlAutoCommit";
import { parseCanonicalTemporalModel } from "@/lib/nlTemporalCalendarModel";
import type {
  ClarificationState,
  InboxItem,
  TemporalState,
} from "@/lib/store";

export type { ClarificationState, TemporalState };

export function temporalStateFromAutoCommitReason(
  reason: AutoCommitBlockReason,
): TemporalState {
  switch (reason) {
    case "date_only":
      return "date_only";
    case "after_work_time":
      return "fuzzy_time";
    case "assumed_meridiem":
    case "weekend_day":
    case "multiple_clocks":
    case "past_today":
    case "clarify_intent":
    case "unresolved_date":
    case "repeat":
      return "ambiguous";
    case "no_clock":
    case "quiet":
    case "empty":
    case "empty_title":
    default:
      return "no_time";
  }
}

export function isAmbiguousTemporalReason(
  reason: AutoCommitBlockReason,
): boolean {
  return temporalStateFromAutoCommitReason(reason) === "ambiguous";
}

/** Canonical record that already has a schedule projection attached. */
export function isStructuredTimedRecord(
  item: Pick<
    InboxItem,
    "temporal_state" | "start_time" | "structured_at"
  >,
): boolean {
  return (
    (item.temporal_state === "exact_datetime" ||
      item.temporal_state === "date_only" ||
      item.temporal_state === "fuzzy_time") &&
    Boolean(item.start_time) &&
    Boolean(item.structured_at)
  );
}

/** Patch that clears structured time without deleting the canonical record. */
export function clearTemporalMetadataPatch(): Partial<InboxItem> {
  return {
    start_time: null,
    end_time: null,
    all_day: null,
    temporal_state: "no_time",
    structured_at: null,
    clarification_state: "dismissed",
  };
}

export function attachExactTemporalPatch(fields: {
  start_time: string;
  end_time: string;
  all_day?: boolean;
  text?: string;
}): Partial<InboxItem> {
  let temporalState: TemporalState = "exact_datetime";
  if (fields.all_day) {
    const model = fields.text
      ? parseCanonicalTemporalModel(fields.text)
      : null;
    temporalState = model?.daypart ? "fuzzy_time" : "date_only";
  }

  return {
    ...(fields.text !== undefined ? { text: fields.text } : {}),
    start_time: fields.start_time,
    end_time: fields.end_time,
    all_day: fields.all_day ?? false,
    temporal_state: temporalState,
    structured_at: new Date().toISOString(),
    clarification_state: "resolved",
  };
}
