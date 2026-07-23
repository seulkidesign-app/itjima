import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("AI server route rejects requests without a verified Supabase session", () => {
  const source = readFileSync(resolve("api/brain-mirror.ts"), "utf8");

  expect(source).toContain("readBearerToken(req)");
  expect(source).toContain("hasValidSupabaseSession(bearerToken)");
  expect(source).toContain('res.status(401).json({ error: "Authentication required" })');

  const authCheck = source.indexOf("hasValidSupabaseSession(bearerToken)");
  const anthropicCall = source.indexOf("callAnthropicJson(apiKey");
  expect(authCheck).toBeGreaterThan(-1);
  expect(anthropicCall).toBeGreaterThan(authCheck);
});

test("AI client only calls the server with a Supabase access token", () => {
  const source = readFileSync(resolve("src/lib/brainMirrorApi.ts"), "utf8");

  expect(source).toContain("supabase.auth.getSession()");
  expect(source).toContain("Authorization: `Bearer ${data.session.access_token}`");
  expect(source).toContain('if (!headers) return { status: "unavailable" }');
});
