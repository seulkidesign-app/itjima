import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json(401, { ok: false, error: "missing_authorization" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("delete-account: missing server environment variables");
    return json(500, { ok: false, error: "server_not_configured" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    return json(401, { ok: false, error: "invalid_session" });
  }

  // Keep this list aligned with the public schema. Every operation is
  // idempotent, so a partially completed request can be safely retried.
  const tables = [
    "scheduled_reminders",
    "push_subscriptions",
    "user_archive_meta",
    "memories",
    "feedback",
    "user_roles",
    "schedules",
    "archive",
    "inbox",
  ] as const;

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id);
    if (error) {
      console.error(`delete-account: failed to delete ${table}`, error.message);
      return json(500, {
        ok: false,
        error: "data_deletion_failed",
        source: table,
      });
    }
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error("delete-account: failed to delete auth user", deleteUserError.message);
    return json(500, { ok: false, error: "account_deletion_failed" });
  }

  return json(200, { ok: true });
});
