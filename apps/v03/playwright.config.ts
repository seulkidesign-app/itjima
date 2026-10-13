import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/storage/**",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4183",
    ...devices["Pixel 7"],
    locale: "ko-KR",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: process.env.V03_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.V03_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://127.0.0.1:4183",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      VITE_V03_SUPABASE_URL: "",
      VITE_V03_SUPABASE_PROJECT_REF: "",
      VITE_V03_SUPABASE_PUBLISHABLE_KEY: "",
    },
  },
});
