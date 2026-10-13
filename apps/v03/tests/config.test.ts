import { describe, expect, it } from "vitest";
import { connectionConfig, V02_REF } from "../src/integrations/config";
const ref = "zzuytanimpiflygrwqfb";
const env = {
  VITE_V03_SUPABASE_URL: `https://${ref}.supabase.co`,
  VITE_V03_SUPABASE_PROJECT_REF: ref,
  VITE_V03_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
};
describe("V03 environment isolation", () => {
  it("does not fall back to V02 env", () =>
    expect(
      connectionConfig({ VITE_SUPABASE_URL: "https://v02.supabase.co" }).config,
    ).toBeNull());
  it("blocks V02 project", () =>
    expect(
      connectionConfig({
        ...env,
        VITE_V03_SUPABASE_URL: `https://${V02_REF}.supabase.co`,
        VITE_V03_SUPABASE_PROJECT_REF: V02_REF,
      }).error,
    ).toContain("V02"));
  it("rejects a mismatched ref", () =>
    expect(
      connectionConfig({ ...env, VITE_V03_SUPABASE_PROJECT_REF: "wrong" })
        .error,
    ).not.toBeNull());
  it("blocks secret keys", () =>
    expect(
      connectionConfig({
        ...env,
        VITE_V03_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test_only",
      }).error,
    ).not.toBeNull());
  it("accepts complete public V03 config", () =>
    expect(connectionConfig(env).config?.ref).toBe(ref));
});
