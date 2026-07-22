import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import {
  readArchiveMetaPayload,
  writeArchiveMetaPayload,
  type ArchiveGroupDef,
  type ArchiveMetaPayload,
} from "@/lib/archiveMeta";

export function mergeArchiveMeta(
  local: ArchiveMetaPayload,
  remote: ArchiveMetaPayload,
): ArchiveMetaPayload {
  const customByKey = new Map<string, ArchiveGroupDef>();
  for (const g of remote.customGroups) customByKey.set(g.key, g);
  for (const g of local.customGroups) customByKey.set(g.key, g);

  const visits = { ...remote.visits };
  for (const [id, count] of Object.entries(local.visits)) {
    visits[id] = Math.max(visits[id] ?? 0, count);
  }

  return {
    pins: [...new Set([...remote.pins, ...local.pins])],
    titles: { ...remote.titles, ...local.titles },
    tags: { ...remote.tags, ...local.tags },
    visits,
    groupOverrides: { ...remote.groupOverrides, ...local.groupOverrides },
    customGroups: [...customByKey.values()],
    collapsed: [...new Set([...remote.collapsed, ...local.collapsed])],
    schedulePins: [...new Set([...remote.schedulePins, ...local.schedulePins])],
    updatedAt: Math.max(local.updatedAt, remote.updatedAt, Date.now()),
  };
}

export function parseArchiveMetaPayload(raw: unknown): ArchiveMetaPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  const obj = (v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  const customGroups = Array.isArray(r.customGroups)
    ? (r.customGroups as ArchiveGroupDef[]).filter(
        (g) => g && typeof g.key === "string" && typeof g.ko === "string",
      )
    : [];
  const tagsRaw = obj(r.tags) as Record<string, unknown>;
  const tags: Record<string, string[]> = {};
  for (const [id, val] of Object.entries(tagsRaw)) {
    if (Array.isArray(val)) tags[id] = val.filter((x) => typeof x === "string");
  }
  return {
    pins: arr(r.pins),
    titles: Object.fromEntries(
      Object.entries(obj(r.titles)).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>,
    tags,
    visits: Object.fromEntries(
      Object.entries(obj(r.visits))
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => [k, v as number]),
    ),
    groupOverrides: Object.fromEntries(
      Object.entries(obj(r.groupOverrides)).filter(
        ([, v]) => typeof v === "string",
      ),
    ) as Record<string, string>,
    customGroups,
    collapsed: arr(r.collapsed),
    schedulePins: arr(r.schedulePins),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
  };
}

export async function pullArchiveMeta(userId: string): Promise<ArchiveMetaPayload | null> {
  const { data, error } = await supabase
    .from("user_archive_meta")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[sync] fetch user_archive_meta", error.message);
    return null;
  }
  if (!data?.data) return null;
  return parseArchiveMetaPayload(data.data);
}

export async function pushArchiveMeta(
  userId: string,
  payload: ArchiveMetaPayload,
): Promise<boolean> {
  const body = {
    ...payload,
    updatedAt: Date.now(),
  };
  const { error } = await supabase.from("user_archive_meta").upsert(
    {
      user_id: userId,
      data: body as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[sync] upsert user_archive_meta", error.message);
    return false;
  }
  return true;
}

export async function syncArchiveMetaFromCloud(userId: string): Promise<boolean> {
  const local = readArchiveMetaPayload();
  const remote = await pullArchiveMeta(userId);
  if (remote === null) {
    return pushArchiveMeta(userId, local);
  }
  const merged = mergeArchiveMeta(local, remote);
  writeArchiveMetaPayload(merged);
  return pushArchiveMeta(userId, merged);
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleArchiveMetaPush(userId: string) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushArchiveMeta(userId, readArchiveMetaPayload());
  }, 800);
}
