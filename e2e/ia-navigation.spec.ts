import { test, expect, type Page } from "@playwright/test";
import {
  GUEST_ARCHIVE_KEY,
  GUEST_SCHEDULE_KEY,
  readGuestList,
  addThought,
  phone,
} from "./helpers";

async function resetForIa(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("itjima.")) localStorage.removeItem(k);
    }
    localStorage.setItem("itjima_lang", "en");
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("link", { name: /^Throw/ }).waitFor({ state: "visible" });
}

async function seedGuestData(page: Page) {
  const now = Date.now();
  const start = new Date(now + 2 * 60 * 60 * 1000);
  const end = new Date(now + 3 * 60 * 60 * 1000);
  await page.evaluate(
    ({ sk, ak, startIso, endIso, createdIso }) => {
      localStorage.setItem(
        sk,
        JSON.stringify([
          {
            id: "qa-ia-task",
            text: "Buy flowers for Mom",
            start_time: startIso,
            end_time: endIso,
            alarm: false,
            created_at: createdIso,
            status: "active",
          },
        ]),
      );
      localStorage.setItem(
        ak,
        JSON.stringify([
          {
            id: "qa-ia-map",
            text: "Mom birthday idea",
            images: [],
            created_at: createdIso,
          },
        ]),
      );
    },
    {
      sk: GUEST_SCHEDULE_KEY,
      ak: GUEST_ARCHIVE_KEY,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      createdIso: new Date(now).toISOString(),
    },
  );
}

test.describe("IA navigation (Throw / Schedule / Archive)", () => {
  test.beforeEach(async ({ page }) => {
    await resetForIa(page);
    await seedGuestData(page);
    await page.reload();
    await page.getByRole("link", { name: /^Throw/ }).waitFor({ state: "visible" });
  });

  test("tabs, route labels, and guest data persist across navigation", async ({
    page,
  }) => {
    await expect(page.getByRole("link", { name: /^Throw$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Schedule$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Archive$/ })).toBeVisible();

    await page.screenshot({ path: "qa-ia/01-throw.png" });

    await page.getByRole("link", { name: /^Schedule$/ }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(
      page.getByRole("heading", { name: "Today", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Only what you need today — brought back when it matters."),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Upcoming" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Calendar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add task" })).toBeVisible();
    await expect(page.getByText("Buy flowers for Mom")).toBeVisible();

    await page.screenshot({ path: "qa-ia/02-schedule.png" });

    await page.getByRole("link", { name: /^Archive$/ }).click();
    await expect(page).toHaveURL(/\/archive$/);
    await expect(
      page.getByRole("heading", { name: "Vault", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Search and revisit everything you entrusted"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "List", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Thought map" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Revisit" })).toBeVisible();
    await expect(page.getByText("Mom birthday idea").first()).toBeVisible();

    await page.screenshot({ path: "qa-ia/03-archive-shell.png" });

    await page.getByRole("link", { name: /^Throw$/ }).click();
    await expect(page).toHaveURL("/");

    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    const archive = await readGuestList(page, GUEST_ARCHIVE_KEY);
    expect(schedules.length).toBe(1);
    expect((schedules[0] as { text: string }).text).toBe("Buy flowers for Mom");
    expect(archive.length).toBe(1);
    expect((archive[0] as { text: string }).text).toBe("Mom birthday idea");
  });
});

test.describe("IA visual QA viewports", () => {
  for (const width of [320, 375, 390, 430]) {
    test(`Korean nav and home fit at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("itjima.")) localStorage.removeItem(k);
        }
        localStorage.setItem("itjima_lang", "ko");
        sessionStorage.clear();
      });
      await page.reload();
      await phone(page).getByRole("link", { name: /^던지기$/ }).waitFor();

      await expect(phone(page).getByRole("link", { name: /^던지기$/ })).toBeVisible();
      await expect(phone(page).getByRole("link", { name: /^일정$/ })).toBeVisible();
      await expect(phone(page).getByRole("link", { name: /^보관함$/ })).toBeVisible();

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

      await phone(page).screenshot({
        path: `qa-ia/ko-nav-${width}.png`,
      });
    });

    test(`decision deck controls fit at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("itjima.")) localStorage.removeItem(k);
        }
        localStorage.setItem("itjima_lang", "en");
        sessionStorage.clear();
      });
      await page.reload();
      await addThought(page, `Deck layout ${width}`);
      await phone(page).getByTestId("decision-launcher").click();
      await phone(page)
        .getByRole("dialog", { name: "One by one" })
        .waitFor({ state: "visible" });

      await expect(phone(page).getByTestId("decision-btn-today")).toBeVisible();
      await expect(phone(page).getByTestId("decision-btn-later")).toBeVisible();
      await expect(phone(page).getByTestId("decision-btn-archive")).toBeVisible();

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

      await phone(page).screenshot({
        path: `qa-ia/deck-${width}.png`,
      });
    });
  }
});
