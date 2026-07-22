import { supabase } from "@/integrations/supabase/client";
import type {
  ArchiveItem,
  InboxItem,
  ScheduleItem,
} from "@/lib/store";
import {
  defaultMemoryTimezone,
  findMemoryByLegacy,
  migrateLegacyBucketsToMemories,
  normalizeMemoryRow,
  type Memory,
} from "@/lib/memory";

const GUEST = "guest";
export const MEMORY_MIGRATION_VERSION = 1;

const LEGACY_KEYS = {
  inbox: "itjima.inbox",
  schedules: "itjima.schedules",
  archive: "itjima.archive",
} as const;

export type MemoryMigrationState = {
  version: number;
  status: "pending" | "complete" | "failed";
  completed_at?: string;
  error?: string;
  migrated_count?: number;
};

function memoriesKey(userId: string | null) {
  return `itjima.${userId ?? GUEST}.memories`;
}

function migrationKey(userId: string | null) {
  return `itjima.${userId ?? GUEST}.memories_migration`;
}

function legacyBucketKey(kind: keyof typeof LEGACY_KEYS, userId: string | null) {
  return `itjima.${userId ?? GUEST}.${kind}`;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("itjima:memories", { detail: key }));
}

function readMigrationState(userId: string | null): MemoryMigrationState | null {
  return readJSON<MemoryMigrationState | null>(migrationKey(userId), null);
}

function writeMigrationState(userId: string | null, state: MemoryMigrationState) {
  writeJSON(migrationKey(userId), state);
}

export function readLocalMemories(userId: string | null): Memory[] {
  const raw = readJSON<unknown[]>(memoriesKey(userId), []);
  return raw
    .map((row) => normalizeMemoryRow(row))
    .filter((row): row is Memory => row !== null);
}

export function writeLocalMemories(userId: string | null, memories: Memory[]) {
  writeJSON(memoriesKey(userId), memories);
}

function readLegacyBucket<T>(kind: keyof typeof LEGACY_KEYS, userId: string | null): T[] {
  const scoped = readJSON<T[]>(legacyBucketKey(kind, userId), []);
  if (scoped.length) return scoped;
  const legacy = readJSON<T[]>(LEGACY_KEYS[kind], []);
  return legacy;
}

function mergeGuestMemoriesIntoUser(userId: string) {
  const guestMemories = readLocalMemories(GUEST);
  if (!guestMemories.length) return;

  const userMemories = readLocalMemories(userId);
  const merged = [...userMemories];
  let added = 0;

  for (const memory of guestMemories) {
    const source = memory.provenance?.legacy_source;
    const legacyId = memory.provenance?.legacy_id;
    if (source && legacyId && findMemoryByLegacy(merged, source, legacyId)) {
      continue;
    }
    if (merged.some((m) => m.id === memory.id)) continue;
    merged.push(memory);
    added += 1;
  }

  if (added > 0) {
    writeLocalMemories(userId, merged);
  }
  writeLocalMemories(GUEST, []);
}

export function runLocalMemoryMigration(userId: string | null): MemoryMigrationState {
  const timezone = defaultMemoryTimezone();
  const existingState = readMigrationState(userId);
  if (
    existingState?.status === "complete" &&
    existingState.version >= MEMORY_MIGRATION_VERSION
  ) {
    return existingState;
  }

  writeMigrationState(userId, {
    version: MEMORY_MIGRATION_VERSION,
    status: "pending",
  });

  try {
    if (userId) {
      mergeGuestMemoriesIntoUser(userId);
    }

    const inbox = readLegacyBucket<InboxItem>("inbox", userId);
    const schedules = readLegacyBucket<ScheduleItem>("schedules", userId);
    const archive = readLegacyBucket<ArchiveItem>("archive", userId);

    const existing = readLocalMemories(userId);
    const { memories, added } = migrateLegacyBucketsToMemories(
      { inbox, schedules, archive },
      existing,
      timezone,
    );

    writeLocalMemories(userId, memories);

    const complete: MemoryMigrationState = {
      version: MEMORY_MIGRATION_VERSION,
      status: "complete",
      completed_at: new Date().toISOString(),
      migrated_count: added,
    };
    writeMigrationState(userId, complete);
    return complete;
  } catch (err) {
    const failed: MemoryMigrationState = {
      version: MEMORY_MIGRATION_VERSION,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
    writeMigrationState(userId, failed);
    return failed;
  }
}

export function ensureCanonicalMemoriesMigrated(userId: string | null) {
  if (typeof window === "undefined") return;
  if (userId) {
    runLocalMemoryMigration(GUEST);
  }
  runLocalMemoryMigration(userId);
}

export function getMemoryMigrationState(
  userId: string | null,
): MemoryMigrationState | null {
  return readMigrationState(userId);
}

function memoryToCloudRow(userId: string, memory: Memory) {
  return {
    id: memory.id,
    user_id: userId,
    status: memory.status,
    content: memory.content,
    provenance: memory.provenance,
    resurface_at: memory.resurface_at,
    resurface_on: memory.resurface_on,
    resurface_timezone: memory.resurface_timezone,
    resurface_precision: memory.resurface_precision,
    resurface_reason: memory.resurface_reason,
    resurface_reason_source: memory.resurface_reason_source,
    timing_confidence: memory.timing_confidence,
    snooze_count: memory.snooze_count,
    resolution_kind: memory.resolution_kind,
    created_at: memory.created_at,
    updated_at: memory.updated_at,
  };
}

export async function syncMemoriesFromCloud(userId: string): Promise<boolean> {
  ensureCanonicalMemoriesMigrated(userId);

  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[sync] fetch memories", error.message);
    return false;
  }

  const cloud = (data ?? [])
    .map((row) => normalizeMemoryRow(row))
    .filter((row): row is Memory => row !== null);

  const local = readLocalMemories(userId);
  const merged = new Map<string, Memory>();

  for (const row of local) merged.set(row.id, row);
  for (const row of cloud) {
    const prior = row.provenance
      ? findMemoryByLegacy(
          [...merged.values()],
          row.provenance.legacy_source,
          row.provenance.legacy_id,
        )
      : undefined;
    if (prior) {
      const keep =
        new Date(row.updated_at).getTime() >= new Date(prior.updated_at).getTime()
          ? row
          : prior;
      merged.delete(prior.id);
      merged.set(keep.id, keep);
      continue;
    }
    merged.set(row.id, row);
  }

  writeLocalMemories(userId, [...merged.values()]);
  return true;
}

export async function upsertMemoryToCloud(
  userId: string,
  memory: Memory,
): Promise<boolean> {
  const { error } = await supabase
    .from("memories")
    .upsert(memoryToCloudRow(userId, memory) as never, { onConflict: "id" });
  if (error) {
    console.error("[sync] upsert memory", error.message);
    return false;
  }
  return true;
}

export { memoriesKey, migrationKey, GUEST as MEMORY_GUEST_ID };
