import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback } from "react";

export type InboxItem = { id: string; text: string; images: string[]; created_at: string };
export type ScheduleItem = {
  id: string;
  text: string;
  start_time: string;
  end_time: string;
  alarm: boolean;
  created_at: string;
};
export type ArchiveItem = { id: string; text: string; images: string[]; created_at: string };

const K = {
  inbox: "itjima.inbox",
  schedules: "itjima.schedules",
  archive: "itjima.archive",
  usage: "itjima.usageCount",
  loginDismissed: "itjima.loginDismissed",
};

function readLS<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as T[];
  } catch {
    return [];
  }
}
function writeLS<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("itjima:update", { detail: key }));
}

function uid() {
  return crypto.randomUUID();
}

/** Hook returning current auth user id (or null) and reacting to changes. */
export function useUserId() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUid(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return uid;
}

/** Generic local-first list hook. Reads localStorage; if signed-in, mirrors to cloud table. */
function useLocalList<T extends { id: string; created_at: string }>(
  key: string,
  table: "inbox" | "schedules" | "archive",
) {
  const userId = useUserId();
  const [items, setItems] = useState<T[]>([]);

  // Hydrate from localStorage after mount to avoid SSR/client mismatch
  useEffect(() => {
    setItems(readLS<T>(key));
  }, [key]);

  // Refresh on cross-component updates
  useEffect(() => {
    const handler = (e: Event) => {
      const k = (e as CustomEvent).detail;
      if (k === key) setItems(readLS<T>(key));
    };
    window.addEventListener("itjima:update", handler as EventListener);
    return () => window.removeEventListener("itjima:update", handler as EventListener);
  }, [key]);

  // Pull from cloud when signed in (one-way merge on login)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (data) {
        const local = readLS<T>(key);
        const localOnly = local.filter((l) => !data.find((d: any) => d.id === l.id));
        // Push local-only to cloud
        if (localOnly.length) {
          await supabase.from(table).insert(localOnly.map((it: any) => ({ ...it, user_id: userId })));
        }
        const merged = [...localOnly, ...(data as unknown as T[])].sort(
          (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
        );
        writeLS(key, merged);
      }
    })();
  }, [userId, key, table]);

  const add = useCallback(
    async (partial: Partial<T> & { text: string }) => {
      const item = {
        id: uid(),
        created_at: new Date().toISOString(),
        images: [],
        ...partial,
      } as unknown as T;
      const next = [item, ...readLS<T>(key)];
      writeLS(key, next);
      if (userId) {
        await supabase.from(table).insert({ ...(item as any), user_id: userId });
      }
      // bump usage
      if (table === "inbox") {
        const u = Number(localStorage.getItem(K.usage) || "0") + 1;
        localStorage.setItem(K.usage, String(u));
      }
      return item;
    },
    [key, userId, table],
  );

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      const next = readLS<T>(key).map((it) => (it.id === id ? { ...it, ...patch } : it));
      writeLS(key, next);
      if (userId) {
        await supabase.from(table).update(patch as any).eq("id", id);
      }
    },
    [key, userId, table],
  );

  const remove = useCallback(
    async (id: string) => {
      const next = readLS<T>(key).filter((it) => it.id !== id);
      writeLS(key, next);
      if (userId) {
        await supabase.from(table).delete().eq("id", id);
      }
    },
    [key, userId, table],
  );

  return { items, add, update, remove };
}

export const useInbox = () => useLocalList<InboxItem>(K.inbox, "inbox");
export const useSchedules = () => useLocalList<ScheduleItem>(K.schedules, "schedules");
export const useArchive = () => useLocalList<ArchiveItem>(K.archive, "archive");

export function getUsageCount() {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(K.usage) || "0");
}
export function isLoginDismissed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(K.loginDismissed) === "1";
}
export function dismissLogin() {
  localStorage.setItem(K.loginDismissed, "1");
}
