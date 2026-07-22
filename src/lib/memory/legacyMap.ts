import { parseBrainMirrorResult } from "@/lib/brainMirror";
import type {
  ArchiveItem,
  InboxItem,
  ScheduleItem,
} from "@/lib/store";
import { createCapturedMemory } from "./transitions";
import { localDateInTimezone } from "./validation";
import type {
  LegacyMemorySource,
  Memory,
  MemoryContent,
  MemoryProvenance,
  ResurfacePlan,
} from "./types";

export function legacyProvenanceKey(
  source: LegacyMemorySource,
  legacyId: string,
): string {
  return `${source}:${legacyId}`;
}

export function findMemoryByLegacy(
  memories: Memory[],
  source: LegacyMemorySource,
  legacyId: string,
): Memory | undefined {
  return memories.find(
    (memory) =>
      memory.provenance?.legacy_source === source &&
      memory.provenance?.legacy_id === legacyId,
  );
}

function contentFromInbox(item: InboxItem): MemoryContent {
  return {
    text: item.text,
    images: item.images ?? [],
    raw_text: item.text,
    brain_mirror: item.brain_mirror ?? null,
  };
}

function contentFromArchive(item: ArchiveItem): MemoryContent {
  return {
    text: item.text,
    images: item.images ?? [],
    raw_text: item.raw_text ?? item.text,
    brain_mirror: item.brain_mirror ?? null,
  };
}

function contentFromSchedule(item: ScheduleItem): MemoryContent {
  return {
    text: item.text,
    images: item.images ?? [],
    raw_text: item.raw_text ?? item.text,
    brain_mirror: item.brain_mirror ?? null,
  };
}

function provenanceFromLegacy<T extends Record<string, unknown>>(
  source: LegacyMemorySource,
  item: T,
  sourceId?: string | null,
): MemoryProvenance {
  return {
    legacy_source: source,
    legacy_id: String(item.id),
    legacy_payload: item,
    source_id: sourceId ?? null,
  };
}

function isValidScheduleStart(startTime: string | undefined | null): boolean {
  if (!startTime) return false;
  const date = new Date(startTime);
  return !Number.isNaN(date.getTime());
}

function scheduleResurfacePlan(
  item: ScheduleItem,
  timezone: string,
): ResurfacePlan | null {
  if (!isValidScheduleStart(item.start_time)) return null;
  const start = new Date(item.start_time);
  const dayOnly = item.start_all_day === true || item.all_day === true;

  if (dayOnly) {
    return {
      precision: "day",
      resurface_on: localDateInTimezone(start, timezone),
      resurface_timezone: timezone,
      resurface_reason: null,
      resurface_reason_source: "legacy",
    };
  }

  return {
    precision: "exact",
    resurface_at: start.toISOString(),
    resurface_timezone: timezone,
    resurface_reason: null,
    resurface_reason_source: "legacy",
  };
}

export function mapInboxToMemory(
  item: InboxItem,
  timezone: string,
  memoryId: string = crypto.randomUUID(),
): Memory {
  return createCapturedMemory({
    id: memoryId,
    content: contentFromInbox(item),
    provenance: provenanceFromLegacy("inbox", item as unknown as Record<string, unknown>),
    created_at: item.created_at,
    resurface_timezone: timezone,
  });
}

export function mapArchiveToMemory(
  item: ArchiveItem,
  timezone: string,
  memoryId: string = crypto.randomUUID(),
): Memory {
  const captured = createCapturedMemory({
    id: memoryId,
    content: contentFromArchive(item),
    provenance: provenanceFromLegacy(
      "archive",
      item as unknown as Record<string, unknown>,
      item.source_id ?? null,
    ),
    created_at: item.created_at,
    resurface_timezone: timezone,
  });
  if (item.resolution_kind) {
    return {
      ...captured,
      status: "resolved",
      resolution_kind: item.resolution_kind,
      updated_at: item.resolved_at ?? item.created_at,
    };
  }
  return {
    ...captured,
    status: "kept",
    updated_at: item.created_at,
  };
}

export function mapScheduleToMemory(
  item: ScheduleItem,
  timezone: string,
  memoryId: string = crypto.randomUUID(),
): Memory {
  const base = createCapturedMemory({
    id: memoryId,
    content: contentFromSchedule(item),
    provenance: provenanceFromLegacy(
      "schedule",
      item as unknown as Record<string, unknown>,
      item.source_id ?? null,
    ),
    created_at: item.created_at,
    resurface_timezone: timezone,
  });

  if (item.status === "done") {
    return {
      ...base,
      status: "resolved",
      resolution_kind: "completed",
      updated_at: item.created_at,
    };
  }

  const plan = scheduleResurfacePlan(item, timezone);
  if (!plan) {
    return base;
  }

  if (plan.precision === "exact") {
    return {
      ...base,
      status: "waiting",
      resurface_precision: "exact",
      resurface_at: plan.resurface_at ?? null,
      resurface_on: null,
      resurface_timezone: plan.resurface_timezone,
      resurface_reason: plan.resurface_reason ?? null,
      resurface_reason_source: plan.resurface_reason_source,
      timing_confidence: null,
      updated_at: item.created_at,
    };
  }

  return {
    ...base,
    status: "waiting",
    resurface_precision: "day",
    resurface_at: null,
    resurface_on: plan.resurface_on ?? null,
    resurface_timezone: plan.resurface_timezone,
    resurface_reason: plan.resurface_reason ?? null,
    resurface_reason_source: plan.resurface_reason_source,
    timing_confidence: null,
    updated_at: item.created_at,
  };
}

export function normalizeMemoryRow(row: unknown): Memory | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.status !== "string") return null;
  if (typeof r.created_at !== "string" || typeof r.updated_at !== "string") {
    return null;
  }

  const contentRaw = r.content;
  if (!contentRaw || typeof contentRaw !== "object") return null;
  const contentObj = contentRaw as Record<string, unknown>;
  if (typeof contentObj.text !== "string") return null;

  const imagesRaw = contentObj.images;
  const images = Array.isArray(imagesRaw)
    ? imagesRaw.filter((v): v is string => typeof v === "string")
    : [];

  const provenanceRaw = r.provenance;
  let provenance: MemoryProvenance | null = null;
  if (provenanceRaw && typeof provenanceRaw === "object") {
    const p = provenanceRaw as Record<string, unknown>;
    if (
      typeof p.legacy_source === "string" &&
      typeof p.legacy_id === "string"
    ) {
      provenance = {
        legacy_source: p.legacy_source as LegacyMemorySource,
        legacy_id: p.legacy_id,
        legacy_payload:
          p.legacy_payload && typeof p.legacy_payload === "object"
            ? (p.legacy_payload as Record<string, unknown>)
            : null,
        source_id:
          typeof p.source_id === "string" || p.source_id === null
            ? (p.source_id as string | null)
            : null,
      };
    }
  }

  const status = r.status as Memory["status"];
  if (
    status !== "captured" &&
    status !== "waiting" &&
    status !== "kept" &&
    status !== "resolved"
  ) {
    return null;
  }

  const precisionRaw = r.resurface_precision;
  const resurface_precision =
    precisionRaw === "exact" || precisionRaw === "day" ? precisionRaw : null;

  const reasonSourceRaw = r.resurface_reason_source;
  const resurface_reason_source =
    reasonSourceRaw === "ai" ||
    reasonSourceRaw === "manual" ||
    reasonSourceRaw === "legacy" ||
    reasonSourceRaw === "system"
      ? reasonSourceRaw
      : null;

  const resolutionRaw = r.resolution_kind;
  const resolution_kind =
    resolutionRaw === "completed" || resolutionRaw === "no_longer_needed"
      ? resolutionRaw
      : null;

  return {
    id: r.id,
    status,
    content: {
      text: contentObj.text,
      images,
      raw_text:
        typeof contentObj.raw_text === "string" || contentObj.raw_text === null
          ? (contentObj.raw_text as string | null)
          : null,
      brain_mirror: parseBrainMirrorResult(contentObj.brain_mirror),
    },
    provenance,
    resurface_at:
      typeof r.resurface_at === "string" || r.resurface_at === null
        ? (r.resurface_at as string | null)
        : null,
    resurface_on:
      typeof r.resurface_on === "string" || r.resurface_on === null
        ? (r.resurface_on as string | null)
        : null,
    resurface_timezone:
      typeof r.resurface_timezone === "string"
        ? r.resurface_timezone
        : timezoneFallback(),
    resurface_precision,
    resurface_reason:
      typeof r.resurface_reason === "string" || r.resurface_reason === null
        ? (r.resurface_reason as string | null)
        : null,
    resurface_reason_source,
    timing_confidence:
      typeof r.timing_confidence === "number" ? r.timing_confidence : null,
    snooze_count:
      typeof r.snooze_count === "number" && r.snooze_count >= 0
        ? Math.floor(r.snooze_count)
        : 0,
    resolution_kind,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function timezoneFallback(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }
  return "UTC";
}

export type LegacyBuckets = {
  inbox: InboxItem[];
  schedules: ScheduleItem[];
  archive: ArchiveItem[];
};

export function migrateLegacyBucketsToMemories(
  buckets: LegacyBuckets,
  existing: Memory[],
  timezone: string,
): { memories: Memory[]; added: number } {
  const out = [...existing];
  let added = 0;

  const upsert = (candidate: Memory) => {
    const source = candidate.provenance?.legacy_source;
    const legacyId = candidate.provenance?.legacy_id;
    if (source && legacyId) {
      const prior = findMemoryByLegacy(out, source, legacyId);
      if (prior) return;
    }
    out.push(candidate);
    added += 1;
  };

  for (const item of buckets.inbox) {
    upsert(mapInboxToMemory(item, timezone));
  }
  for (const item of buckets.schedules) {
    upsert(mapScheduleToMemory(item, timezone));
  }
  for (const item of buckets.archive) {
    upsert(mapArchiveToMemory(item, timezone));
  }

  return { memories: out, added };
}
