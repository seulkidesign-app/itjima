import type {
  Memory,
  MemoryStatus,
  ResurfacePlan,
  ResurfacePrecision,
  ResolutionKind,
} from "./types";
import { memoryErr, type MemoryResult } from "./types";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function defaultMemoryTimezone(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }
  return "UTC";
}

export function localDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

export function validateResurfacePlan(
  plan: ResurfacePlan,
): MemoryResult<ResurfacePlan> {
  if (plan.precision === "exact") {
    if (!plan.resurface_at) {
      return memoryErr(
        "MISSING_RESURFACE",
        "Exact resurface requires resurface_at",
      );
    }
    const at = new Date(plan.resurface_at);
    if (Number.isNaN(at.getTime())) {
      return memoryErr("INVALID_RESURFACE", "resurface_at is not a valid ISO timestamp");
    }
    if (plan.resurface_on) {
      return memoryErr(
        "INVALID_RESURFACE",
        "Exact resurface cannot include resurface_on",
      );
    }
    return { ok: true, value: plan };
  }

  if (!plan.resurface_on) {
    return memoryErr("MISSING_RESURFACE", "Day resurface requires resurface_on");
  }
  if (!isValidDateOnly(plan.resurface_on)) {
    return memoryErr("INVALID_RESURFACE", "resurface_on must be YYYY-MM-DD");
  }
  if (plan.resurface_at) {
    return memoryErr(
      "INVALID_RESURFACE",
      "Day resurface cannot include resurface_at",
    );
  }
  return { ok: true, value: plan };
}

export function assertWaitingResurface(memory: Memory): MemoryResult<Memory> {
  if (memory.status !== "waiting") {
    return memoryErr(
      "INVALID_TRANSITION",
      "Waiting status requires resurface fields",
      { from: memory.status, to: "waiting" },
    );
  }
  if (memory.resurface_precision === "exact") {
    if (!memory.resurface_at) {
      return memoryErr("MISSING_RESURFACE", "Waiting exact memory requires resurface_at");
    }
  } else if (memory.resurface_precision === "day") {
    if (!memory.resurface_on) {
      return memoryErr("MISSING_RESURFACE", "Waiting day memory requires resurface_on");
    }
  } else if (!memory.resurface_at && !memory.resurface_on) {
    return memoryErr("MISSING_RESURFACE", "Waiting memory requires resurface_at or resurface_on");
  }
  return { ok: true, value: memory };
}

export function assertResolvedKind(
  kind: ResolutionKind | null | undefined,
): MemoryResult<ResolutionKind> {
  if (!kind) {
    return memoryErr("MISSING_RESOLUTION", "Resolved memory requires resolution_kind");
  }
  return { ok: true, value: kind };
}

export function applyResurfacePlan(
  memory: Memory,
  plan: ResurfacePlan,
  now = new Date(),
): Memory {
  const validated = validateResurfacePlan(plan);
  if (!validated.ok) return memory;

  return {
    ...memory,
    status: "waiting",
    resurface_precision: plan.precision,
    resurface_at: plan.precision === "exact" ? (plan.resurface_at ?? null) : null,
    resurface_on: plan.precision === "day" ? (plan.resurface_on ?? null) : null,
    resurface_timezone: plan.resurface_timezone,
    resurface_reason: plan.resurface_reason ?? null,
    resurface_reason_source: plan.resurface_reason_source,
    timing_confidence:
      plan.timing_confidence === undefined ? null : plan.timing_confidence,
    resolution_kind: null,
    updated_at: now.toISOString(),
  };
}

export function clearResurfaceFields(memory: Memory, now = new Date()): Memory {
  return {
    ...memory,
    resurface_at: null,
    resurface_on: null,
    resurface_precision: null,
    resurface_reason: null,
    resurface_reason_source: null,
    timing_confidence: null,
    updated_at: now.toISOString(),
  };
}

export function canTransition(from: MemoryStatus, to: MemoryStatus): boolean {
  if (from === to) return to === "waiting";
  switch (from) {
    case "captured":
      return to === "waiting" || to === "kept" || to === "resolved";
    case "waiting":
      return to === "waiting" || to === "resolved";
    case "kept":
      return to === "resolved";
    case "resolved":
      return to === "captured" || to === "waiting";
    default:
      return false;
  }
}

export function precisionFromMemory(memory: Memory): ResurfacePrecision | null {
  if (memory.resurface_precision) return memory.resurface_precision;
  if (memory.resurface_at) return "exact";
  if (memory.resurface_on) return "day";
  return null;
}
