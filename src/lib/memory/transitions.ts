import {
  applyResurfacePlan,
  assertResolvedKind,
  assertWaitingResurface,
  canTransition,
  clearResurfaceFields,
  defaultMemoryTimezone,
  validateResurfacePlan,
} from "./validation";
import type {
  Memory,
  MemoryContent,
  MemoryProvenance,
  MemoryResult,
  ResurfacePlan,
  ResolutionKind,
} from "./types";
import { memoryErr, memoryOk } from "./types";

function stamp(memory: Memory, patch: Partial<Memory>, now = new Date()): Memory {
  return {
    ...memory,
    ...patch,
    updated_at: now.toISOString(),
  };
}

function transitionGuard(
  memory: Memory,
  to: Memory["status"],
): MemoryResult<Memory> {
  if (!canTransition(memory.status, to)) {
    return memoryErr("INVALID_TRANSITION", `Cannot move from ${memory.status} to ${to}`, {
      from: memory.status,
      to,
    });
  }
  return memoryOk(memory);
}

export function createCapturedMemory(input: {
  id: string;
  content: MemoryContent;
  provenance?: MemoryProvenance | null;
  created_at?: string;
  resurface_timezone?: string;
}): Memory {
  const now = input.created_at ?? new Date().toISOString();
  return {
    id: input.id,
    status: "captured",
    content: input.content,
    provenance: input.provenance ?? null,
    resurface_at: null,
    resurface_on: null,
    resurface_timezone: input.resurface_timezone ?? defaultMemoryTimezone(),
    resurface_precision: null,
    resurface_reason: null,
    resurface_reason_source: null,
    timing_confidence: null,
    snooze_count: 0,
    resolution_kind: null,
    created_at: now,
    updated_at: now,
  };
}

export function confirmResurface(
  memory: Memory,
  plan: ResurfacePlan,
): MemoryResult<Memory> {
  const guard = transitionGuard(memory, "waiting");
  if (!guard.ok) return guard;
  const validated = validateResurfacePlan(plan);
  if (!validated.ok) return validated;
  const next = applyResurfacePlan(memory, validated.value);
  return assertWaitingResurface(next);
}

export function keepMemory(memory: Memory): MemoryResult<Memory> {
  const guard = transitionGuard(memory, "kept");
  if (!guard.ok) return guard;
  return memoryOk(
    stamp(clearResurfaceFields(guard.value), {
      status: "kept",
      snooze_count: 0,
    }),
  );
}

export function snoozeMemory(
  memory: Memory,
  plan: ResurfacePlan,
): MemoryResult<Memory> {
  if (memory.status !== "waiting") {
    return memoryErr("INVALID_TRANSITION", "Snooze requires waiting status", {
      from: memory.status,
      to: "waiting",
    });
  }
  const validated = validateResurfacePlan(plan);
  if (!validated.ok) return validated;
  const next = applyResurfacePlan(memory, validated.value);
  next.snooze_count = memory.snooze_count + 1;
  return assertWaitingResurface(next);
}

export function resolveMemory(
  memory: Memory,
  kind: ResolutionKind,
): MemoryResult<Memory> {
  const guard = transitionGuard(memory, "resolved");
  if (!guard.ok) return guard;
  const kindResult = assertResolvedKind(kind);
  if (!kindResult.ok) return kindResult;
  return memoryOk(
    stamp(clearResurfaceFields(guard.value), {
      status: "resolved",
      resolution_kind: kindResult.value,
      snooze_count: 0,
    }),
  );
}

export function reopenMemory(
  memory: Memory,
  plan?: ResurfacePlan,
): MemoryResult<Memory> {
  if (memory.status !== "resolved") {
    return memoryErr("INVALID_TRANSITION", "Reopen requires resolved status", {
      from: memory.status,
      to: plan ? "waiting" : "captured",
    });
  }
  if (plan) {
    const reopened = stamp(clearResurfaceFields(memory), {
      status: "captured",
      resolution_kind: null,
      snooze_count: 0,
    });
    return confirmResurface(reopened, plan);
  }
  return memoryOk(
    stamp(clearResurfaceFields(memory), {
      status: "captured",
      resolution_kind: null,
      snooze_count: 0,
    }),
  );
}
