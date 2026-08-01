import { test, expect, type Page } from "@playwright/test";
import {
  CAPTURE_LINK_NAME,
  GUEST_ARCHIVE_KEY,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  readGuestList,
  addThought,
  phone,
  resetAppState,
} from "./helpers";

async function enableLegacyArchiveFeatures(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem(
      "itjima.__feature_overrides__",
      JSON.stringify({
        ARCHIVE_AI_GROUPING: true,
        ARCHIVE_THOUGHT_MAP: true,
      }),
    );
  });
  await page.reload();
  await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor();
}

test.describe("Schedule V1", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.evaluate(
      ({ sk, ik }) => {
        // Build dates in the browser context so they use Playwright's configured
        // application timezone instead of the runner's UTC timezone.
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 0, 0);

        const laterStart = new Date(now);
        laterStart.setDate(laterStart.getDate() + 4);
        laterStart.setHours(10, 0, 0, 0);
        const laterEnd = new Date(laterStart.getTime() + 60 * 60 * 1000);

        localStorage.setItem(
          sk,
          JSON.stringify([
            {
              id: "qa-today-task",
              text: "Today compact row",
              start_time: todayStart.toISOString(),
              end_time: todayEnd.toISOString(),
              alarm: false,
              created_at: now.toISOString(),
              all_day: true,
              start_all_day: true,
              end_all_day: true,
              status: "active",
            },
            {
              id: "qa-later-task",
              text: "Later dated task",
              start_time: laterStart.toISOString(),
              end_time: laterEnd.toISOString(),
              alarm: false,
              created_at: now.toISOString(),
              status: "active",
            },
          ]),
        );
        localStorage.setItem(
          ik,
          JSON.stringify([
            {
              id: "qa-later-inbox",
              text: "Later without date",
              images: [],
              created_at: now.toISOString(),
              decision: "later",
              decided_at: now.toISOString(),
            },
          ]),
        );
      },
      { sk: GUEST_SCHEDULE_KEY, ik: GUEST_INBOX_KEY },
    );
    await page.reload();
    await phone(page).getByRole("link", { name: /^Schedule/ }).waitFor();
  });

  test("page heading and today compact list", async ({ page }) => {
    await phone(page).getByRole("link", { name: /^Schedule/ }).click();
    await phone(page).getByRole("tab", { name: "Today" }).click();
    await expect(
      phone(page).getByRole("heading", { name: "Schedule", exact: true }),
    ).toBeVisible();
    await expect(
      phone(page).getByText("Today and what's coming — in one place."),
    ).toBeVisible();
    await expect(phone(page).getByTestId("schedule-today-list")).toBeVisible();
    await expect(phone(page).getByText("Today compact row")).toBeVisible();
  });

  test("upcoming groups later and date-less inbox items", async ({ page }) => {
    await phone(page).getByRole("link", { name: /^Schedule/ }).click();
    await phone(page).getByRole("tab", { name: "Upcoming" }).click();
    await expect(phone(page).getByTestId("upcoming-section-today")).toBeVisible();
    await expect(phone(page).getByTestId("upcoming-section-after")).toBeVisible();
    await expect(phone(page).getByTestId("upcoming-section-noDate")).toBeVisible();
    await expect(phone(page).getByText("Later dated task")).toBeVisible();
    await expect(phone(page).getByText("Later without date")).toBeVisible();
    await expect(phone(page).getByText("Started")).toHaveCount(0);
  });
});

test.describe("Archive V1", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.evaluate(({ ak }) => {
      localStorage.setItem(
        ak,
        JSON.stringify([
          {
            id: "qa-idea",
            text: "Startup idea for cafe",
            images: [],
            created_at: new Date().toISOString(),
          },
          {
            id: "qa-link",
            text: "https://example.com/reference",
            images: [],
            created_at: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: "qa-memo",
            text: "Remember to call dentist",
            images: [],
            created_at: new Date(Date.now() - 172800000).toISOString(),
          },
        ]),
      );
    }, { ak: GUEST_ARCHIVE_KEY });
    await page.reload();
    await phone(page).getByRole("link", { name: /^Archive/ }).waitFor();
  });

  test("heading, search, filters, and hidden legacy modes", async ({ page }) => {
    await phone(page).getByRole("link", { name: /^Archive/ }).click();
    await expect(
      phone(page).getByRole("heading", { name: "Archive", exact: true }),
    ).toBeVisible();
    await expect(
      phone(page).getByText("Find what you saved, when you need it."),
    ).toBeVisible();
    await expect(
      phone(page).getByTestId("archive-grouped-list").or(
        phone(page).getByTestId("archive-v1-list"),
      ),
    ).toBeVisible();
    await expect(phone(page).getByRole("button", { name: "Thought map" })).toHaveCount(0);
    await expect(phone(page).getByRole("link", { name: "Revisit" })).toHaveCount(0);
    await expect(phone(page).getByText("Threads that connect")).toHaveCount(0);

    await phone(page).getByPlaceholder("Find a thought you kept").fill("dentist");
    await expect(phone(page).getByTestId("archive-search-results")).toBeVisible();
    await expect(phone(page).getByText("Remember to call dentist")).toBeVisible();

    await phone(page).getByPlaceholder("Find a thought you kept").fill("");
    await phone(page).getByTestId("archive-category-filters").getByRole("button", { name: "Links" }).click();
    await expect(phone(page).getByTestId("archive-list-row").filter({ hasText: "example.com" })).toBeVisible();
    await expect(phone(page).getByText("Startup idea for cafe")).toHaveCount(0);
  });

  test("legacy thought map remains available behind feature flag", async ({
    page,
  }) => {
    await enableLegacyArchiveFeatures(page);
    await phone(page).getByRole("link", { name: /^Archive/ }).click();
    await phone(page).getByRole("button", { name: "Thought map" }).click();
    await expect(phone(page).getByText("Vault › Thought map")).toBeVisible();
  });
});

test.describe("Schedule and Archive viewport overflow", () => {
  for (const width of [320, 375, 390, 430]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await resetAppState(page);
      await addThought(page, `Viewport ${width}`);
      await phone(page).getByRole("link", { name: /^Schedule/ }).click();
      let metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

      await phone(page).getByRole("link", { name: /^Archive/ }).click();
      metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    });
  }
});
