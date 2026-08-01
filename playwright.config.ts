import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "en-US",
    timezoneId: "America/New_York",
  },
  projects: [
    {
      name: "mobile-chrome",
      testMatch: "**/*.spec.ts",
      testIgnore: "**/responsive-matrix.spec.ts",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
      },
    },
    {
      name: "responsive-matrix-chrome",
      testMatch: "**/responsive-matrix.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "tablet-chrome",
      testMatch: "**/responsive-critical.spec.ts",
      use: {
        browserName: "chromium",
        viewport: { width: 834, height: 1112 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "desktop-chrome",
      testMatch: "**/responsive-critical.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: {
    command:
      "VITE_E2E=true npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    // Always serve the VITE_E2E build from `command` above — reusing a
    // non-E2E preview breaks signed-in fixtures (itjima.__e2e_user_id__).
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
