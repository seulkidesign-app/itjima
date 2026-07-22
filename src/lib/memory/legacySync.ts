import type { ArchiveItem, InboxItem, ScheduleItem } from "@/lib/store";
import {
  confirmResurface,
  keepMemory,
  reopenMemory,
  resolveMemory,
  snoozeMemory,
} from "./transitions";
import {
  findMemoryByLegacy,
  mapArchiveToMemory,
  mapInboxToMemory,
  mapScheduleToMemory,
} from "./legacyMap";
import type {
  LegacyMemorySource,
  Memory,
  ResolutionKind,
  ResurfacePlan,
} from "./types";

export type LegacyMemoryItem = InboxItem | ScheduleItem | ArchiveItem;

export type MemoryWriteIntent =
  | "sync"
  | "copy"
  | "snooze"
  | "completed"
  | "no_longer_needed";

type ReconcileResult = {
  memories: Memory[];
  memory: Memory;
};

function sourceIdOf(item: LegacyMemoryItem): string | null {
  if (!("source_id" in item)) return null;
  return typeof item.source_id === "string" ? item.source_id : null;
}

function findRelatedMemory(
  memories: Memory[],
  source: LegacyMemorySource,
  item: LegacyMemoryItem,
): Memory | undefined {
  const exact = findMemoryByLegacy(memories, source, item.id);
  if (exact) return exact;

  if (source === "inbox") {
    const byOrigin = memories.find(
      (memory) => memory.provenance?.source_id === item.id,
    );
    if (byOrigin) return byOrigin;
  }

  const sourceId = sourceIdOf(item);
  if (!sourceId) return undefined;

  return memories.find(
    (memory) =>
      memory.provenance?.legacy_id === sourceId ||
      memory.provenance?.source_id === sourceId,
  );
}

function mapLegacyItem(
  source: LegacyMemorySource,
  item: LegacyMemoryItem,
  timezone: string,
  memoryId: string,
): Memory {
  if (source === "inbox") {
    return mapInboxToMemory(item as InboxItem, timezone, memoryId);
  }
  if (source === "schedule") {
    return mapScheduleToMemory(item as ScheduleItem, timezone, memoryId);
  }
  return mapArchiveToMemory(item as ArchiveItem, timezone, memoryId);
}

function planFromMapped(memory: Memory): ResurfacePlan | null {
  if (memory.resurface_precision === "exact" && memory.resurface_at) {
    return {
      precision: "exact",
      resurface_at: memory.resurface_at,
      resurface_timezone: memory.resurface_timezone,
      resurface_reason: memory.resurface_reason,
      resurface_reason_source: memory.resurface_reason_source ?? "legacy",
      timing_confidence: memory.timing_confidence,
    };
  }
  if (memory.resurface_precision === "day" && memory.resurface_on) {
    return {
      precision: "day",
      resurface_on: memory.resurface_on,
      resurface_timezone: memory.resurface_timezone,
      resurface_reason: memory.resurface_reason,
      resurface_reason_source: memory.resurface_reason_source ?? "legacy",
      timing_confidence: memory.timing_confidence,
    };
  }
  return null;
}

function carryIdentity(existing: Memory, mapped: Memory): Memory {
  return {
    ...mapped,
    content: {
      ...mapped.content,
      images:
        mapped.content.images.length > 0
          ? mapped.content.images
          : existing.content.images,
      raw_text: mapped.content.raw_text ?? existing.content.raw_text,
      brain_mirror:
        mapped.content.brain_mirror ?? existing.content.brain_mirror,
    },
    id: existing.id,
    created_at: existing.created_at,
    snooze_count: existing.snooze_count,
  };
}

function withLatestLegacyShape(memory: Memory, mapped: Memory): Memory {
  return {
    ...memory,
    content: {
      ...mapped.content,
      images:
        mapped.content.images.length > 0
          ? mapped.content.images
          : memory.content.images,
      raw_text: mapped.content.raw_text ?? memory.content.raw_text,
      brain_mirror: mapped.content.brain_mirror ?? memory.content.brain_mirror,
    },
    provenance: mapped.provenance,
    updated_at: memory.updated_at,
  };
}

function resolveExisting(
  existing: Memory,
  mapped: Memory,
  kind: ResolutionKind,
): Memory {
  if (existing.status === "resolved") {
    return {
      ...withLatestLegacyShape(existing, mapped),
      resolution_kind: kind,
      resurface_at: null,
      resurface_on: null,
      resurface_precision: null,
      resurface_reason: null,
      resurface_reason_source: null,
      timing_confidence: null,
      updated_at: new Date().toISOString(),
    };
  }
  const resolved = resolveMemory(withLatestLegacyShape(existing, mapped), kind);
  if (resolved.ok) return resolved.value;
  return {
    ...carryIdentity(existing, mapped),
    status: "resolved",
    resolution_kind: kind,
    resurface_at: null,
    resurface_on: null,
    resurface_precision: null,
    resurface_reason: null,
    resurface_reason_source: null,
    timing_confidence: null,
    snooze_count: 0,
    updated_at: new Date().toISOString(),
  };
}

function reconcileExisting(
  existing: Memory,
  mapped: Memory,
  source: LegacyMemorySource,
  item: LegacyMemoryItem,
  intent: MemoryWriteIntent,
): Memory {
  const current = withLatestLegacyShape(existing, mapped);

  if (intent === "completed") {
    return resolveExisting(current, mapped, "completed");
  }
  if (intent === "no_longer_needed") {
    return resolveExisting(current, mapped, "no_longer_needed");
  }

  if (source === "inbox") {
    const inbox = item as InboxItem;
    if (inbox.status === "deleted") {
      return resolveExisting(current, mapped, "no_longer_needed");
    }
    if (existing.status === "resolved") {
      const reopened = reopenMemory(current);
      return reopened.ok
        ? withLatestLegacyShape(reopened.value, mapped)
        : mapped;
    }
    return {
      ...carryIdentity(existing, mapped),
      status: "captured",
      updated_at: new Date().toISOString(),
    };
  }

  if (source === "archive") {
    if (mapped.status === "resolved" && mapped.resolution_kind) {
      return resolveExisting(current, mapped, mapped.resolution_kind);
    }
    // A resolved memory remains resolved when it is copied into the Archive
    // compatibility bucket so completion meaning is not erased.
    if (existing.status === "resolved") {
      return withLatestLegacyShape(existing, mapped);
    }
    const kept = keepMemory(current);
    if (kept.ok) return withLatestLegacyShape(kept.value, mapped);
    return {
      ...carryIdentity(existing, mapped),
      status: "kept",
      resurface_at: null,
      resurface_on: null,
      resurface_precision: null,
      resurface_reason: null,
      resurface_reason_source: null,
      timing_confidence: null,
      resolution_kind: null,
      updated_at: new Date().toISOString(),
    };
  }

  const schedule = item as ScheduleItem;
  if (schedule.status === "done") {
    return resolveExisting(current, mapped, "completed");
  }

  const plan = planFromMapped(mapped);
  if (!plan) {
    return {
      ...carryIdentity(existing, mapped),
      status: "captured",
      updated_at: new Date().toISOString(),
    };
  }

  if (intent === "snooze" && existing.status === "waiting") {
    const snoozed = snoozeMemory(current, plan);
    if (snoozed.ok) return withLatestLegacyShape(snoozed.value, mapped);
  }

  if (existing.status === "captured") {
    const waiting = confirmResurface(current, plan);
    if (waiting.ok) return withLatestLegacyShape(waiting.value, mapped);
  }

  if (existing.status === "resolved") {
    const reopened = reopenMemory(current, plan);
    if (reopened.ok) return withLatestLegacyShape(reopened.value, mapped);
  }

  return {
    ...carryIdentity(existing, mapped),
    status: "waiting",
    resolution_kind: null,
    snooze_count: existing.snooze_count,
    updated_at: new Date().toISOString(),
  };
}

export function reconcileLegacyMemory(
  memories: Memory[],
  source: LegacyMemorySource,
  item: LegacyMemoryItem,
  timezone: string,
  intent: MemoryWriteIntent = "sync",
): ReconcileResult {
  const existing =
    intent === "copy"
      ? findMemoryByLegacy(memories, source, item.id)
      : findRelatedMemory(memories, source, item);
  const memoryId =
    existing?.id ??
    (memories.some((candidate) => candidate.id === item.id)
      ? crypto.randomUUID()
      : item.id);
  const mapped = mapLegacyItem(source, item, timezone, memoryId);

  const memory = existing
    ? reconcileExisting(existing, mapped, source, item, intent)
    : intent === "completed" || intent === "no_longer_needed"
      ? resolveExisting(
          {
            ...mapped,
            status: mapped.status === "resolved" ? "resolved" : "captured",
          },
          mapped,
          intent === "completed" ? "completed" : "no_longer_needed",
        )
      : intent === "snooze" && mapped.status === "waiting"
        ? {
            ...mapped,
            snooze_count: 1,
            updated_at: new Date().toISOString(),
          }
        : mapped;

  const next = existing
    ? memories.map((candidate) =>
        candidate.id === existing.id ? memory : candidate,
      )
    : [...memories, memory];

  return { memories: next, memory };
}

export function resolveRemovedLegacyMemory(
  memories: Memory[],
  source: LegacyMemorySource,
  legacyId: string,
  kind: ResolutionKind = "no_longer_needed",
): ReconcileResult | null {
  const existing = findMemoryByLegacy(memories, source, legacyId);
  if (!existing) return null;
  let memory: Memory;
  if (existing.status === "resolved") {
    memory = {
      ...existing,
      resolution_kind: existing.resolution_kind ?? kind,
      updated_at: new Date().toISOString(),
    };
  } else {
    const resolved = resolveMemory(existing, kind);
    if (resolved.ok) {
      memory = resolved.value;
    } else {
      memory = {
        ...existing,
        status: "resolved",
        resolution_kind: kind,
        resurface_at: null,
        resurface_on: null,
        resurface_precision: null,
        resurface_reason: null,
        resurface_reason_source: null,
        timing_confidence: null,
        snooze_count: 0,
        updated_at: new Date().toISOString(),
      };
    }
  }
  return {
    memory,
    memories: memories.map((candidate) =>
      candidate.id === existing.id ? memory : candidate,
    ),
  };
}
