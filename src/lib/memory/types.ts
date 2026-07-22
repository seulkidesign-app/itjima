import type { BrainMirrorResult } from "@/lib/brainMirror";

export type MemoryStatus = "captured" | "waiting" | "kept" | "resolved";

export type ResolutionKind = "completed" | "no_longer_needed";

export type ResurfacePrecision = "exact" | "day";

export type ResurfaceReasonSource = "ai" | "manual" | "legacy" | "system";

export type LegacyMemorySource = "inbox" | "schedule" | "archive";

export type MemoryContent = {
  text: string;
  images: string[];
  raw_text?: string | null;
  brain_mirror?: BrainMirrorResult | null;
};

export type MemoryProvenance = {
  legacy_source: LegacyMemorySource;
  legacy_id: string;
  legacy_payload?: Record<string, unknown> | null;
  source_id?: string | null;
};

export type Memory = {
  id: string;
  status: MemoryStatus;
  content: MemoryContent;
  provenance: MemoryProvenance | null;
  resurface_at: string | null;
  resurface_on: string | null;
  resurface_timezone: string;
  resurface_precision: ResurfacePrecision | null;
  resurface_reason: string | null;
  resurface_reason_source: ResurfaceReasonSource | null;
  timing_confidence: number | null;
  snooze_count: number;
  resolution_kind: ResolutionKind | null;
  created_at: string;
  updated_at: string;
};

export type ResurfacePlan = {
  precision: ResurfacePrecision;
  resurface_at?: string | null;
  resurface_on?: string | null;
  resurface_timezone: string;
  resurface_reason?: string | null;
  resurface_reason_source: ResurfaceReasonSource;
  timing_confidence?: number | null;
};

export type MemoryTemporalState = "not_due" | "due" | "due_today" | "overdue";

export type MemoryTransitionErrorCode =
  | "INVALID_TRANSITION"
  | "MISSING_RESURFACE"
  | "INVALID_RESURFACE"
  | "MISSING_RESOLUTION"
  | "INVALID_RESOLUTION";

export type MemoryTransitionError = {
  code: MemoryTransitionErrorCode;
  message: string;
  from?: MemoryStatus;
  to?: MemoryStatus;
};

export type MemoryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: MemoryTransitionError };

export function memoryOk<T>(value: T): MemoryResult<T> {
  return { ok: true, value };
}

export function memoryErr(
  code: MemoryTransitionErrorCode,
  message: string,
  extra?: Pick<MemoryTransitionError, "from" | "to">,
): MemoryResult<never> {
  return { ok: false, error: { code, message, ...extra } };
}
