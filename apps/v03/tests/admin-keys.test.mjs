import { describe, expect, it } from "vitest";
import {
  adminConfiguration,
  secretHeaders,
  managementHeaders,
  PROJECT_REF,
} from "../scripts/supabase-admin.mjs";
const env = {
  VITE_V03_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
  VITE_V03_SUPABASE_PROJECT_REF: PROJECT_REF,
  V03_SUPABASE_ACCESS_TOKEN: "test-pat",
  V03_SUPABASE_SECRET_KEY: "sb_secret_test_only",
};
describe("server-only latest Supabase keys", () => {
  it("sends secret as apikey, never as Bearer/JWT", () => {
    expect(secretHeaders(env.V03_SUPABASE_SECRET_KEY)).toEqual({
      apikey: "sb_secret_test_only",
      "Content-Type": "application/json",
    });
    expect(
      secretHeaders(env.V03_SUPABASE_SECRET_KEY).Authorization,
    ).toBeUndefined();
  });
  it("uses PAT Bearer only for Management API", () =>
    expect(managementHeaders("test-pat").Authorization).toBe(
      "Bearer test-pat",
    ));
  it("has no service-role fallback", () =>
    expect(() =>
      adminConfiguration({
        ...env,
        V03_SUPABASE_SECRET_KEY: "",
        V03_SUPABASE_SERVICE_ROLE_KEY: "test-legacy",
      }),
    ).toThrow("V03_SUPABASE_SECRET_KEY"));
  it("rejects a different target before any network operation", () =>
    expect(() =>
      adminConfiguration({
        ...env,
        VITE_V03_SUPABASE_PROJECT_REF: "bopiuworvbjsowfjbmfx",
      }),
    ).toThrow("target mismatch"));
  it("accepts proxy-backed secret bindings without inspecting their values", () =>
    expect(
      adminConfiguration({
        ...env,
        V03_SUPABASE_SECRET_KEY: "proxy-placeholder",
      }).url,
    ).toBe(env.VITE_V03_SUPABASE_URL));
});
