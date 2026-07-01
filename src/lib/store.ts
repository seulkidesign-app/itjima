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
  (Object.keys(LEGACY_KEYS) as ListKind[]).forEach((kind) => migrateLegacy(kind, userId));
  if (userId) migrateLegacy("inbox", GUEST);
  if (userId) migrateLegacy("schedules", GUEST);
  if (userId) migrateLegacy("archive", GUEST);
}

function uid() {
  return crypto.randomUUID();
}

function sortByCreated<T extends { created_at: string }>(items: T[]) {
  return [...items].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

function stripCloudFields(item: Record<string, unknown>, table: TableName) {
  const { user_id: _u, ...rest } = item;
  if ("brain_mirror" in rest) {
    rest.brain_mirror = parseBrainMirrorResult(rest.brain_mirror);
  }
  return rest;
}

function toCloudRow(table: TableName, item: Record<string, unknown>, userId: string) {
  return { ...item, user_id: userId };
}

async function cloudUpsertMany<T extends { id: string }>(
  table: TableName,
  userId: string,
  items: T[],
) {
  if (!items.length) return;
  const payload = items.map((it) => toCloudRow(table, it as Record<string, unknown>, userId));
  const { error } = await supabase.from(table).upsert(payload as never[], { onConflict: "id" });
  if (error) console.error(`[sync] upsert ${table}`, error.message);
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

function useLocalList<T extends { id: string; created_at: string }>(kind: ListKind, table: TableName) {
  const userId = useUserId();
  const [items, setItems] = useState<T[]>([]);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "ready">("idle");
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
    return () => window.removeEventListener("itjima:update", handler as EventListener);
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

      const guestKey = storageKey(kind, GUEST);
      const localUser = readLS<T>(key, table);
      const guestItems = readLS<T>(guestKey, table);
      const localAll = sortByCreated([...localUser, ...guestItems.filter((g) => !localUser.some((l) => l.id === g.id))]);

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

      const cloud = (data ?? []).map((row) => stripCloudFields(row as Record<string, unknown>, table) as T);
      const cloudIds = new Set(cloud.map((c) => c.id));
      const toUpload = localAll.filter((item) => !cloudIds.has(item.id));

      if (toUpload.length) {
        await cloudUpsertMany(table, userId, toUpload);
      }

      const mergedMap = new Map<string, T>();
      const localById = new Map(localAll.map((item) => [item.id, item]));
      for (const row of cloud) {
        const local = localById.get(row.id) as (T & { brain_mirror?: BrainMirrorResult | null }) | undefined;
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
        const { error } = await supabase
          .from(table)
          .insert(toCloudRow(table, item as Record<string, unknown>, userId) as never);
        if (error) {
          cloudSynced = false;
          console.error(`[sync] insert ${table}`, error.message);
        }
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
      const next = readLS<T>(key, table).map((it) => (it.id === id ? { ...it, ...patch } : it));
      writeLS(key, next);
      if (userId) {
        const cloudPatch = { ...(patch as Record<string, unknown>) };
        if (Object.keys(cloudPatch).length > 0) {
          const { error } = await supabase
            .from(table)
            .update(cloudPatch as never)
            .eq("id", id)
            .eq("user_id", userId);
          if (error) console.error(`[sync] update ${table}`, error.message);
        }
      }
    },
    [key, userId, table],
  );

  const remove = useCallback(
    async (id: string) => {
      const next = readLS<T>(key, table).filter((it) => it.id !== id);
      writeLS(key, next);
      if (userId) {
        const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", userId);
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
export const useSchedules = () => useLocalList<ScheduleItem>("schedules", "schedules");
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
