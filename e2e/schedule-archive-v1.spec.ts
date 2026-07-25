import { test, expect, type Page } from "@playwright/test";
import {
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
  await phone(page).getByRole("link", { name: /^Throw/ }).waitFor();
}

test.describe("Schedule V1", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    const now = Date.now();
    const todayStart = new Date(now + 2 * 60 * 60 * 1000);
    todayStart.setSeconds(0, 0);
    // Keep fixture on today's calendar day (avoid midnight rollover flakiness).
    if (todayStart.toDateString() !== new Date(now).toDateString()) {
      todayStart.setTime(now);
      todayStart.setHours(15, 0, 0, 0);
    }
    const todayEnd = new Date(todayStart.getTime() + 60 * 60 * 1000);
    const laterStart = new Date();
    laterStart.setDate(laterStart.getDate() + 4);
    laterStart.setHours(10, 0, 0, 0);
    const laterEnd = new Date(laterStart.getTime() + 60 * 60 * 1000);

    await page.evaluate(
      ({ sk, ik, todayStartIso, todayEndIso, laterStartIso, laterEndIso }) => {
        localStorage.setItem(
          sk,
          JSON.stringify([
            {
              id: "qa-today-task",
              text: "Today compact row",
              start_time: todayStartIso,
              end_time: todayEndIso,
              alarm: false,
              created_at: new Date().toISOString(),
              status: "active",
            },
            {
              id: "qa-later-task",
              text: "Later dated task",
              start_time: laterStartIso,
              end_time: laterEndIso,
              alarm: false,
              created_at: new Date().toISOString(),
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
              created_at: new Date().toISOString(),
              decision: "later",
              decided_at: new Date().toISOString(),
            },
          ]),
        );
      },
      {
        sk: GUEST_SCHEDULE_KEY,
        ik: GUEST_INBOX_KEY,
        todayStartIso: todayStart.toISOString(),
        todayEndIso: todayEnd.toISOString(),
        laterStartIso: laterStart.toISOString(),
        laterEndIso: laterEnd.toISOString(),
      },
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
