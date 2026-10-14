// Node/server-only operations. Never import into Vite client modules.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const PROJECT_REF = "zzuytanimpiflygrwqfb";
export function secretHeaders(secret) {
  // sb_secret is an API key, not a JWT. Do not send it as a Bearer token.
  return { apikey: secret, "Content-Type": "application/json" };
}
export function managementHeaders(pat) {
  return { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" };
}
export function adminConfiguration(env) {
  const names = [
    "VITE_V03_SUPABASE_URL",
    "VITE_V03_SUPABASE_PROJECT_REF",
    "V03_SUPABASE_ACCESS_TOKEN",
    "V03_SUPABASE_SECRET_KEY",
  ];
  const missing = names.filter((name) => !env[name]);
  if (missing.length)
    throw new Error(
      `Missing environment variable names: ${missing.join(", ")}`,
    );
  if (
    env.VITE_V03_SUPABASE_PROJECT_REF !== PROJECT_REF ||
    env.VITE_V03_SUPABASE_URL.replace(/\/$/, "") !==
      `https://${PROJECT_REF}.supabase.co`
  ) {
    throw new Error("V03 target mismatch. No remote operation performed.");
  }
  // Proxy-backed bindings may be placeholders: do not inspect or log their values.
  return {
    url: `https://${PROJECT_REF}.supabase.co`,
    pat: env.V03_SUPABASE_ACCESS_TOKEN,
    secret: env.V03_SUPABASE_SECRET_KEY,
  };
}
async function request(url, headers, body) {
  let response;
  try {
    response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(
      "Remote request failed. Check the runtime proxy/network policy and credential readiness.",
    );
  }
  if (!response.ok)
    throw new Error(
      `Remote endpoint HTTP ${response.status}; response body withheld.`,
    );
  return response.json();
}
export async function checkAdmin(config) {
  const project = await request(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}`,
    managementHeaders(config.pat),
  );
  if ((project.id ?? project.ref) !== PROJECT_REF)
    throw new Error("Management API returned an unexpected project.");
  await request(
    `${config.url}/auth/v1/admin/users?page=1&per_page=1`,
    secretHeaders(config.secret),
  );
  console.log(
    "V03 Management API and server-only Auth admin access verified. No user data printed.",
  );
}
async function main() {
  const config = adminConfiguration(process.env);
  await checkAdmin(config);
  if (process.argv.includes("--apply")) {
    const existing = await request(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      managementHeaders(config.pat),
      { query: "select to_regclass('public.v03_imports')::text as existing" },
    );
    if (
      !Array.isArray(existing) ||
      existing.length !== 1 ||
      existing[0].existing !== null
    )
      throw new Error(
        "Schema exists or schema observation is unknown; inspect before applying again.",
      );
    const sql = await readFile(
      new URL(
        "../supabase/migrations/202610140001_v03_initial.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await request(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      managementHeaders(config.pat),
      { query: `SET v03.project_ref = '${PROJECT_REF}';\n${sql}` },
    );
    console.log(
      "Applied 202610140001_v03_initial.sql through Management API/PAT.",
    );
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
