import { supabase } from "@/integrations/supabase/client";
import {
  parseBrainMirrorResult,
  finalizeBrainMirror,
  type BrainMirrorCore,
  type BrainMirrorResult,
} from "@/lib/brainMirror";
import { useEffect, useState, useCallback, useRef } from "react";

export type { BrainMirrorResult };

export type ThoughtStatus = "active" | "done" | "archived" | "deleted";

export type InboxItem = {
  id: string;
  text: string;
  images: string[];
  created_at: string;
  status?: ThoughtStatus;
  brain_mirror?: BrainMirrorResult | null;
};
export type RepeatRule = "daily" | "weekly" | "monthly" | "yearly";

export type ScheduleStatus = "active" | "done";

export type ScheduleItem = {
  id: string;
  text: string;
  start_time: string;
  end_time: string;
  alarm: boolean;
  created_at: string;
  all_day?: boolean;
  repeat?: RepeatRule | null;
  source_id?: string | null;
  raw_text?: string | null;
  brain_mirror?: BrainMirrorResult | null;
  status?: ScheduleStatus;
  alarm_at?: string | null;
};
export type ArchiveItem = {
  id: string;
  text: string;
  images: string[];
  created_at: string;
  brain_mirror?: BrainMirrorResult | null;
  source_id?: string | null;
  raw_text?: string | null;
};

type ListKind = "inbox" | "schedules" | "archive";
type TableName = "inbox" | "schedules" | "archive";

const GUEST = "guest";

const LEGACY_KEYS: Record<ListKind, string> = {
  inbox: "itjima.inbox",
  schedules: "itjima.schedules",
  archive: "itjima.archive",
};

const META = {
  usage: "itjima.usageCount",
  loginDismissed: "itjima.loginDismissed",
};

function storageKey(kind: ListKind, userId: string | null) {
  return `itjima.${userId ?? GUEST}.${kind}`;
}

function readLS<T>(key: string, table: TableName): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]") as unknown[];
    return raw.map((row) => normalizeRow(row, table)) as T[];
  } catch {
    return [];
  }
}

function writeLS<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("itjima:update", { detail: key }));
}

function normalizeRow(row: unknown, table: TableName) {
  if (!row || typeof row !== "object") return row;
  const r = { ...(row as Record<string, unknown>) };
  if (table === "inbox" && !r.status) {
    r.status = "active";
  }
  if (table === "schedules" && !r.status) {
    r.status = "active";
  }
  if ("brain_mirror" in r) {
    r.brain_mirror = parseBrainMirrorResult(r.brain_mirror);
  }
  return r;
}

function migrateLegacy(kind: ListKind, userId: string | null) {
  const legacyKey = LEGACY_KEYS[kind];
  const nextKey = storageKey(kind, userId);
  const legacy = localStorage.getItem(legacyKey);
  if (!legacy || localStorage.getItem(nextKey)) return;
  localStorage.setItem(nextKey, legacy);
  localStorage.removeItem(legacyKey);
}

function migrateAllBuckets(userId: string | null) {
  (Object.keys(LEGACY_KEYS) as ListKind[]).forEach((kind) =>
    migrateLegacy(kind, userId),
  );
  if (userId) migrateLegacy("inbox", GUEST);
  if (userId) migrateLegacy("schedules", GUEST);
  if (userId) migrateLegacy("archive", GUEST);
}

function uid() {
  return crypto.randomUUID();
}

function sortByCreated<T extends { created_at: string }>(items: T[]) {
  return [...items].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

function stripCloudFields(item: Record<string, unknown>, table: TableName) {
  const { user_id: _u, ...rest } = item;
  if ("brain_mirror" in rest) {
    rest.brain_mirror = parseBrainMirrorResult(rest.brain_mirror);
  }
  return rest;
}

const CLOUD_SCHEMA_KEY = "itjima.cloudSchema";

/** Columns present before v0.2 migrations (prod fallback). */
const LEGACY_CLOUD_KEYS: Record<TableName, readonly string[]> = {
  inbox: ["id", "text", "images", "created_at"],
  schedules: ["id", "text", "start_time", "end_time", "alarm", "created_at"],
  archive: ["id", "text", "images", "created_at"],
};

/** Columns after all migrations in supabase/migrations are applied. */
const FULL_CLOUD_KEYS: Record<TableName, readonly string[]> = {
  inbox: ["id", "text", "images", "created_at", "status", "brain_mirror"],
  schedules: [
    "id",
    "text",
    "start_time",
    "end_time",
    "alarm",
    "created_at",
    "all_day",
    "repeat",
    "source_id",
    "raw_text",
    "brain_mirror",
    "status",
    "alarm_at",
  ],
  archive: [
    "id",
    "text",
    "images",
    "created_at",
    "source_id",
    "raw_text",
    "brain_mirror",
  ],
};

function isSchemaColumnError(message: string) {
  return /Could not find the .+ column of .+ in the schema cache/i.test(
    message,
  );
}

function isLegacyCloudSchema() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CLOUD_SCHEMA_KEY) === "legacy";
}

function markLegacyCloudSchema() {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLOUD_SCHEMA_KEY, "legacy");
}

function clearLegacyCloudSchema() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CLOUD_SCHEMA_KEY);
}

async function probeFullCloudSchema(): Promise<boolean> {
  const { error } = await supabase.from("inbox").select("status").limit(1);
  return !error;
}

function pickCloudFields(
  table: TableName,
  fields: Record<string, unknown>,
  userId: string,
  legacy: boolean,
) {
  const allowed = legacy ? LEGACY_CLOUD_KEYS[table] : FULL_CLOUD_KEYS[table];
  const out: Record<string, unknown> = { user_id: userId };
  for (const key of allowed) {
    if (key in fields && fields[key] !== undefined) out[key] = fields[key];
  }
  return out;
}

async function cloudMutate(
  op: "insert" | "update" | "upsert",
  table: TableName,
  userId: string,
  fields: Record<string, unknown>,
  id?: string,
): Promise<boolean> {
  let legacy = isLegacyCloudSchema();

  for (let attempt = 0; attempt < 2; attempt++) {
    const row = pickCloudFields(table, fields, userId, legacy);
    let error: { message: string } | null = null;

    if (op === "insert") {
      ({ error } = await supabase.from(table).insert(row as never));
    } else if (op === "update" && id) {
      const { user_id: _u, ...patch } = row;
      if (!Object.keys(patch).length) return true;
      ({ error } = await supabase
        .from(table)
        .update(patch as never)
        .eq("id", id)
        .eq("user_id", userId));
    } else if (op === "upsert") {
      ({ error } = await supabase
        .from(table)
        .upsert(row as never, { onConflict: "id" }));
    }

    if (!error) {
      if (!legacy) clearLegacyCloudSchema();
      return true;
    }

    if (!legacy && isSchemaColumnError(error.message)) {
      markLegacyCloudSchema();
      legacy = true;
      continue;
    }

    console.error(`[sync] ${op} ${table}`, error.message);
    return false;
  }

  return false;
}

async function cloudUpsertMany<T extends { id: string }>(
  table: TableName,
  userId: string,
  items: T[],
) {
  if (!items.length) return;
  for (const it of items) {
    await cloudMutate("upsert", table, userId, it as Record<string, unknown>);
  }
}

/** Hook returning current auth user id (or null) and reacting to changes. */
export function useUserId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return id;
}

function useLocalList<T extends { id: string; created_at: string }>(
  kind: ListKind,
  table: TableName,
) {
  const userId = useUserId();
  const [items, setItems] = useState<T[]>([]);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "ready">(
    "idle",
  );
  const syncingRef = useRef(false);
  const key = storageKey(kind, userId);

  const reloadLocal = useCallback(() => {
    setItems(readLS<T>(key, table));
  }, [key, table]);

  useEffect(() => {
    migrateAllBuckets(userId);
    reloadLocal();
  }, [userId, reloadLocal]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === key) reloadLocal();
    };
    window.addEventListener("itjima:update", handler as EventListener);
    return () =>
      window.removeEventListener("itjima:update", handler as EventListener);
  }, [key, reloadLocal]);

  useEffect(() => {
    if (!userId) {
      setSyncState("ready");
      return;
    }

    let cancelled = false;
    (async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      setSyncState("syncing");

      if (isLegacyCloudSchema() && (await probeFullCloudSchema())) {
        clearLegacyCloudSchema();
      }

      const guestKey = storageKey(kind, GUEST);
      const localUser = readLS<T>(key, table);
      const guestItems = readLS<T>(guestKey, table);
      const localAll = sortByCreated([
        ...localUser,
        ...guestItems.filter((g) => !localUser.some((l) => l.id === g.id)),
      ]);

      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error(`[sync] fetch ${table}`, error.message);
        writeLS(key, localAll);
        setSyncState("ready");
        syncingRef.current = false;
        return;
      }

      const cloud = (data ?? []).map(
        (row) => stripCloudFields(row as Record<string, unknown>, table) as T,
      );
      const cloudIds = new Set(cloud.map((c) => c.id));
      const toUpload = localAll.filter((item) => !cloudIds.has(item.id));

      if (toUpload.length) {
        await cloudUpsertMany(table, userId, toUpload);
      }

      const mergedMap = new Map<string, T>();
      const localById = new Map(localAll.map((item) => [item.id, item]));
      for (const row of cloud) {
        const local = localById.get(row.id) as
          | (T & { brain_mirror?: BrainMirrorResult | null })
          | undefined;
        mergedMap.set(
          row.id,
          local?.brain_mirror && !(row as InboxItem).brain_mirror
            ? ({ ...row, brain_mirror: local.brain_mirror } as T)
            : row,
        );
      }
      for (const row of toUpload) mergedMap.set(row.id, row);

      const merged = sortByCreated([...mergedMap.values()]);
      writeLS(key, merged);

      if (guestItems.length) {
        writeLS(guestKey, []);
      }

      if (!cancelled) {
        setSyncState("ready");
        syncingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      syncingRef.current = false;
    };
  }, [userId, key, kind, table]);

  const add = useCallback(
    async (partial: Partial<T> & { text: string }) => {
      const item = {
        id: uid(),
        created_at: new Date().toISOString(),
        images: [],
        ...(table === "inbox" ? { status: "active" as ThoughtStatus } : {}),
        ...partial,
      } as unknown as T;

      const next = sortByCreated([item, ...readLS<T>(key, table)]);
      writeLS(key, next);

      let cloudSynced = true;
      if (userId) {
        cloudSynced = await cloudMutate(
          "insert",
          table,
          userId,
          item as Record<string, unknown>,
        );
      }

      if (table === "inbox") {
        const u = Number(localStorage.getItem(META.usage) || "0") + 1;
        localStorage.setItem(META.usage, String(u));
      }

      return { item, cloudSynced };
    },
    [key, userId, table],
  );

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      const next = readLS<T>(key, table).map((it) =>
        it.id === id ? { ...it, ...patch } : it,
      );
      writeLS(key, next);
      if (userId) {
        await cloudMutate(
          "update",
          table,
          userId,
          patch as Record<string, unknown>,
          id,
        );
      }
    },
    [key, userId, table],
  );

  const remove = useCallback(
    async (id: string) => {
      const next = readLS<T>(key, table).filter((it) => it.id !== id);
      writeLS(key, next);
      if (userId) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("id", id)
          .eq("user_id", userId);
        if (error) console.error(`[sync] delete ${table}`, error.message);
      }
    },
    [key, userId, table],
  );

  return { items, add, update, remove, syncState };
}

function useInboxList() {
  const list = useLocalList<InboxItem>("inbox", "inbox");
  const items = list.items.filter((it) => !it.status || it.status === "active");
  const softDelete = useCallback(
    async (id: string) => {
      await list.update(id, { status: "deleted" } as Partial<InboxItem>);
    },
    [list],
  );
  return { ...list, items, softDelete };
}

export const useInbox = () => useInboxList();
export const useSchedules = () =>
  useLocalList<ScheduleItem>("schedules", "schedules");
export const useArchive = () => useLocalList<ArchiveItem>("archive", "archive");

export function getUsageCount() {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(META.usage) || "0");
}
export function isLoginDismissed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(META.loginDismissed) === "1";
}
export function dismissLogin() {
  localStorage.setItem(META.loginDismissed, "1");
}

/** Attach Brain Mirror result to an inbox item (local + cloud when signed in). */
export async function setInboxBrainMirror(
  inbox: ReturnType<typeof useInbox>,
  id: string,
  result: BrainMirrorCore | BrainMirrorResult,
) {
  const existing = inbox.items.find((it) => it.id === id);
  const core: BrainMirrorCore = {
    title: result.title,
    items: result.items,
    suggestedDateText: result.suggestedDateText,
    suggestedAction: result.suggestedAction,
    confidence: result.confidence,
  };
  const snapshot = finalizeBrainMirror(core, existing?.brain_mirror);
  await inbox.update(id, { brain_mirror: snapshot } as Partial<InboxItem>);
}
