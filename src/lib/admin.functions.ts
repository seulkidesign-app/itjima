import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getE2eUserId } from "@/lib/store";

async function requireAuth() {
  const e2eUserId = getE2eUserId();
  if (e2eUserId) return { userId: e2eUserId, supabase };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Unauthorized");
  return { userId: session.user.id, supabase, email: session.user.email ?? null };
}

async function readOwnAdminRole(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!error && data) return true;

  const { data: rpcAdmin, error: rpcError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!rpcError && rpcAdmin) return true;

  return false;
}

async function assertAdmin(userId: string) {
  const isAdmin = await readOwnAdminRole(userId);
  if (!isAdmin) throw new Error("Forbidden");
}

export async function getAdminStats() {
  const { userId } = await requireAuth();
  await assertAdmin(userId);

  const [
    { count: inboxCount },
    { count: scheduleCount },
    { count: archiveCount },
    inboxUsers,
    scheduleUsers,
    archiveUsers,
  ] = await Promise.all([
    supabase.from("inbox").select("*", { count: "exact", head: true }),
    supabase.from("schedules").select("*", { count: "exact", head: true }),
    supabase.from("archive").select("*", { count: "exact", head: true }),
    supabase.from("inbox").select("user_id"),
    supabase.from("schedules").select("user_id"),
    supabase.from("archive").select("user_id"),
  ]);

  const userIds = new Set<string>();
  for (const row of [
    ...(inboxUsers.data ?? []),
    ...(scheduleUsers.data ?? []),
    ...(archiveUsers.data ?? []),
  ]) {
    if (row.user_id) userIds.add(row.user_id);
  }

  return {
    inboxCount: inboxCount ?? 0,
    scheduleCount: scheduleCount ?? 0,
    archiveCount: archiveCount ?? 0,
    userCount: userIds.size,
  };
}

export async function listRecentUsers() {
  const { userId } = await requireAuth();
  await assertAdmin(userId);

  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, role, created_at");
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.user_id,
    email: `${row.user_id.slice(0, 8)}…`,
    created_at: row.created_at,
    last_sign_in_at: null as string | null,
    roles: [row.role],
  }));
}

export async function listRecentThoughts() {
  const { userId } = await requireAuth();
  await assertAdmin(userId);

  const { data, error } = await supabase
    .from("inbox")
    .select("id, user_id, text, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function grantAdmin(data: { userId: string }) {
  const parsed = z.object({ userId: z.string().uuid() }).parse(data);
  const { userId } = await requireAuth();

  if (parsed.userId === userId) {
    if (await readOwnAdminRole(userId)) {
      return { ok: true as const };
    }

    const { error } = await supabase.rpc("bootstrap_admin");
    if (!error) return { ok: true as const };

    if (await readOwnAdminRole(userId)) {
      return { ok: true as const };
    }

    throw new Error(error.message);
  }

  await assertAdmin(userId);

  const { error } = await supabase.rpc("grant_admin_role", {
    _target_user_id: parsed.userId,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function revokeAdmin(data: { userId: string }) {
  const parsed = z.object({ userId: z.string().uuid() }).parse(data);
  const { userId } = await requireAuth();
  await assertAdmin(userId);

  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", parsed.userId)
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function adminDeleteInbox(data: { id: string }) {
  const parsed = z.object({ id: z.string().uuid() }).parse(data);
  const { userId } = await requireAuth();
  await assertAdmin(userId);

  const { error } = await supabase.from("inbox").delete().eq("id", parsed.id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function checkIsAdmin() {
  const { userId, email } = await requireAuth();
  const isAdmin = await readOwnAdminRole(userId);
  return { isAdmin, userId, email };
}

export async function getMyAdminStatus() {
  const { userId, email } = await requireAuth();
  const { data, error } = await supabase.rpc("get_my_admin_status");
  if (error || !data) {
    const isAdmin = await readOwnAdminRole(userId);
    const count = await getAdminCount();
    return {
      isAdmin,
      userId,
      email,
      adminCount: count.count,
    };
  }
  const row = data as {
    is_admin?: boolean;
    admin_count?: number;
    user_id?: string;
  };
  return {
    isAdmin: !!row.is_admin,
    userId: row.user_id ?? userId,
    email,
    adminCount: row.admin_count ?? 0,
  };
}

export async function getAdminCount() {
  const { userId } = await requireAuth();
  const { data, error } = await supabase.rpc("get_admin_count");
  if (error) {
    const { count } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    return { count: count ?? 0, userId };
  }
  return { count: data ?? 0, userId };
}

export async function listFeedback() {
  const { userId } = await requireAuth();
  await assertAdmin(userId);

  const { data, error } = await supabase
    .from("feedback")
    .select(
      "id, user_id, email, category, message, status, page_path, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateFeedbackStatus(data: {
  id: string;
  status: "new" | "reviewing" | "resolved" | "archived";
}) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["new", "reviewing", "resolved", "archived"]),
    })
    .parse(data);
  const { userId } = await requireAuth();
  await assertAdmin(userId);

  const { error } = await supabase
    .from("feedback")
    .update({ status: parsed.status })
    .eq("id", parsed.id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function deleteFeedback(data: { id: string }) {
  const parsed = z.object({ id: z.string().uuid() }).parse(data);
  const { userId } = await requireAuth();
  await assertAdmin(userId);

  const { error } = await supabase
    .from("feedback")
    .delete()
    .eq("id", parsed.id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
