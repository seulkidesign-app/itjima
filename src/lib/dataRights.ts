import { supabase } from "@/integrations/supabase/client";

type ExportWarning = {
  source: string;
  message: string;
};

type DataExport = {
  format: "itjima-data-export";
  version: 1;
  generated_at: string;
  account: {
    id: string | null;
    email: string | null;
  };
  cloud: Record<string, unknown[]>;
  local: Record<string, unknown>;
  warnings: ExportWarning[];
};

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export type AccountDeletionOutcome = "deleted" | "requested";

function parseStoredValue(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

/** Export only Itjima-owned localStorage keys. Auth tokens are intentionally excluded. */
export function collectLocalItjimaData(
  storage: Pick<Storage, "length" | "key" | "getItem"> = localStorage,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith("itjima.")) continue;
    if (key.includes("__e2e")) continue;
    const value = storage.getItem(key);
    if (value === null) continue;
    data[key] = parseStoredValue(value);
  }

  return data;
}

export function clearLocalItjimaData(
  storage: Pick<Storage, "length" | "key" | "removeItem"> = localStorage,
): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith("itjima.")) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
  return keys;
}

export async function clearItjimaCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
}

function keepPushSubscriptionMetadata(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const value = row as Record<string, unknown>;
    return {
      id: value.id,
      endpoint: value.endpoint,
      platform: value.platform,
      created_at: value.created_at,
      updated_at: value.updated_at,
      revoked_at: value.revoked_at,
      failure_count: value.failure_count,
      last_success_at: value.last_success_at,
    };
  });
}

function addQueryResult(
  cloud: Record<string, unknown[]>,
  warnings: ExportWarning[],
  source: string,
  result: QueryResult,
  transform: (rows: unknown[]) => unknown[] = (rows) => rows,
) {
  if (result.error) {
    warnings.push({ source, message: result.error.message });
    cloud[source] = [];
    return;
  }
  cloud[source] = transform(result.data ?? []);
}

export async function buildItjimaDataExport(
  userId: string | null,
): Promise<DataExport> {
  const warnings: ExportWarning[] = [];
  const cloud: Record<string, unknown[]> = {};
  let email: string | null = null;

  if (userId) {
    const userResult = await supabase.auth.getUser();
    if (userResult.error) {
      warnings.push({ source: "account", message: userResult.error.message });
    } else {
      email = userResult.data.user?.email ?? null;
    }

    const [
      inbox,
      schedules,
      archive,
      memories,
      archiveMeta,
      reminders,
      pushSubscriptions,
      feedback,
    ] = await Promise.all([
      supabase.from("inbox").select("*").eq("user_id", userId),
      supabase.from("schedules").select("*").eq("user_id", userId),
      supabase.from("archive").select("*").eq("user_id", userId),
      supabase.from("memories").select("*").eq("user_id", userId),
      supabase.from("user_archive_meta").select("*").eq("user_id", userId),
      supabase.from("scheduled_reminders").select("*").eq("user_id", userId),
      supabase.from("push_subscriptions").select("*").eq("user_id", userId),
      supabase.from("feedback").select("*").eq("user_id", userId),
    ]);

    addQueryResult(cloud, warnings, "inbox", inbox as QueryResult);
    addQueryResult(cloud, warnings, "schedules", schedules as QueryResult);
    addQueryResult(cloud, warnings, "archive", archive as QueryResult);
    addQueryResult(cloud, warnings, "memories", memories as QueryResult);
    addQueryResult(cloud, warnings, "user_archive_meta", archiveMeta as QueryResult);
    addQueryResult(cloud, warnings, "scheduled_reminders", reminders as QueryResult);
    addQueryResult(
      cloud,
      warnings,
      "push_subscriptions",
      pushSubscriptions as QueryResult,
      keepPushSubscriptionMetadata,
    );
    addQueryResult(cloud, warnings, "feedback", feedback as QueryResult);
  }

  return {
    format: "itjima-data-export",
    version: 1,
    generated_at: new Date().toISOString(),
    account: { id: userId, email },
    cloud,
    local: collectLocalItjimaData(),
    warnings,
  };
}

export function dataExportFilename(now = new Date()): string {
  return `itjima-data-${now.toISOString().slice(0, 10)}.json`;
}

export function downloadItjimaDataExport(data: DataExport): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = dataExportFilename(new Date(data.generated_at));
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function functionHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: unknown }).context;
  if (typeof Response !== "undefined" && context instanceof Response) {
    return context.status;
  }
  if (context && typeof context === "object") {
    const status = (context as { status?: unknown }).status;
    return typeof status === "number" ? status : null;
  }
  return null;
}

async function finishLocalAccountRemoval() {
  await supabase.auth.signOut({ scope: "local" });
  clearLocalItjimaData();
  await clearItjimaCaches();
}

async function submitAccountDeletionRequest(): Promise<AccountDeletionOutcome> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error(userError?.message ?? "No signed-in account was found.");
  }

  const { error } = await supabase.from("feedback").insert({
    category: "question",
    message: "ACCOUNT_DELETION_REQUEST",
    user_id: user.id,
    email: user.email ?? null,
    page_path: "/settings/data-privacy",
    user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
  });
  if (error) throw new Error(error.message);

  await finishLocalAccountRemoval();
  return "requested";
}

/**
 * Deletes immediately when the Edge Function is deployed. During staged rollout,
 * a missing function falls back to an authenticated, auditable deletion request.
 */
export async function deleteCurrentAccount(): Promise<AccountDeletionOutcome> {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    method: "POST",
  });

  if (error) {
    if (functionHttpStatus(error) === 404) {
      return submitAccountDeletionRequest();
    }
    throw new Error(error.message);
  }

  const payload = data as { ok?: unknown } | null;
  if (!payload || payload.ok !== true) {
    throw new Error("Account deletion was not confirmed by the server.");
  }

  await finishLocalAccountRemoval();
  return "deleted";
}
