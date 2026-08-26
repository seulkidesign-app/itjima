import { test, expect, type Page } from "@playwright/test";
import {
  GUEST_ARCHIVE_KEY,
  GUEST_SCHEDULE_KEY,
  readGuestList,
  addThought,
  phone,
  CAPTURE_LINK_NAME,
  CAPTURE_LINK_NAME_KO,
} from "./helpers";

const TASKS_SCHEDULE_LINK_NAME = /^Schedule$/;
const TASKS_SCHEDULE_LINK_NAME_KO = /^일정$/;

async function resetForIa(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("itjima.")) localStorage.removeItem(k);
    }
    localStorage.setItem("itjima_lang", "en");
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor({ state: "visible" });
}

async function seedGuestData(page: Page) {
  const now = Date.now();
  const start = new Date(now + 10 * 60 * 1000);
  const end = new Date(now + 70 * 60 * 1000);
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

test.describe("IA navigation (Capture / Tasks & schedule / Archive)", () => {
  test.beforeEach(async ({ page }) => {
    await resetForIa(page);
    await seedGuestData(page);
    await page.reload();
    await page.getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor({ state: "visible" });
  });

  test("tabs, route labels, and guest data persist across navigation", async ({
    page,
  }) => {
    await expect(page.getByRole("link", { name: CAPTURE_LINK_NAME })).toBeVisible();
    await expect(page.getByRole("link", { name: TASKS_SCHEDULE_LINK_NAME })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Archive$/ })).toBeVisible();

    await page.screenshot({ path: "qa-ia/01-capture.png" });

    await page.getByRole("link", { name: TASKS_SCHEDULE_LINK_NAME }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(
      page.getByRole("heading", { name: "Schedule", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Timed records show up here automatically|시간이 포함된 기록/),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Upcoming" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Calendar" })).toBeVisible();
    // V02-05: schedule is review/manage — no global Create FAB on Today/List
    await expect(page.getByRole("button", { name: "Add task" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "할 일 추가" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: CAPTURE_LINK_NAME })).toBeVisible();
    await expect(page.getByText("Buy flowers for Mom")).toBeVisible();

    await page.screenshot({ path: "qa-ia/02-schedule.png" });

    await page.getByRole("link", { name: /^Archive$/ }).click();
    await expect(page).toHaveURL(/\/archive$/);
    await expect(
      page.getByRole("heading", { name: "Archive", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Find what you saved, when you need it."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Thought map" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Revisit" })).toHaveCount(0);
    await expect(page.getByText("Mom birthday idea").first()).toBeVisible();

    await page.screenshot({ path: "qa-ia/03-archive-shell.png" });

    await page.getByRole("link", { name: CAPTURE_LINK_NAME }).click();
    await expect(page).toHaveURL(/\/app\/?$/);

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
      await page.goto("/app");
      await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("itjima.")) localStorage.removeItem(k);
        }
        localStorage.setItem("itjima_lang", "ko");
        sessionStorage.clear();
      });
      await page.reload();
      await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME_KO }).waitFor();

      await expect(phone(page).getByRole("link", { name: CAPTURE_LINK_NAME_KO })).toBeVisible();
      await expect(
        phone(page).getByRole("link", { name: TASKS_SCHEDULE_LINK_NAME_KO }),
      ).toBeVisible();
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

    test(`decision deck entry is unreachable at ${width}px (M2)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/app");
      await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("itjima.")) localStorage.removeItem(k);
        }
        localStorage.setItem("itjima_lang", "en");
        sessionStorage.clear();
      });
      await page.reload();
      await addThought(page, `Deck layout ${width}`);
      await phone(page).getByTestId("left-item-more").last().click();
      const menu = page.getByTestId("inbox-context-menu");
      await expect(
        menu.getByRole("menuitem", { name: "Sort one by one", exact: true }),
      ).toHaveCount(0);
      await expect(
        menu.getByRole("menuitem", { name: /All records|전체 기록/i }),
      ).toBeVisible();
    });
  }
});
