import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./e2e/storage",
  testIgnore: [],
  use: { ...base.use, baseURL: "http://127.0.0.1:4283" },
  webServer: {
    command: "npm run build && npm run preview -- --port 4283",
    url: "http://127.0.0.1:4283",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      VITE_V03_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      VITE_V03_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
      VITE_V03_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
    },
  },
});
