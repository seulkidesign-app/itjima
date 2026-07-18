import { test, expect, type Page } from "@playwright/test";
import {
  GUEST_ARCHIVE_KEY,
  GUEST_SCHEDULE_KEY,
  readGuestList,
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
  await page.getByRole("link", { name: /^Thoughts/ }).waitFor({ state: "visible" });
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

test.describe("IA navigation (Thoughts / Tasks / Thought map)", () => {
  test.beforeEach(async ({ page }) => {
    await resetForIa(page);
    await seedGuestData(page);
    await page.reload();
    await page.getByRole("link", { name: /^Thoughts/ }).waitFor({ state: "visible" });
  });

  test("tabs, route labels, and guest data persist across navigation", async ({
    page,
  }) => {
    await expect(page.getByRole("link", { name: /^Thoughts$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Tasks$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Thought map$/ })).toBeVisible();

    await page.screenshot({ path: "qa-ia/01-thoughts.png" });

    await page.getByRole("link", { name: /^Tasks$/ }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    await expect(
      page.getByRole("heading", { name: "Tasks", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("So you don't forget thoughts that need to be done"),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Today" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Upcoming" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Calendar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add task" })).toBeVisible();
    await expect(page.getByText("Buy flowers for Mom")).toBeVisible();

    await page.screenshot({ path: "qa-ia/02-tasks.png" });

    await page.getByRole("link", { name: /^Thought map$/ }).click();
    await expect(page).toHaveURL(/\/archive$/);
    await expect(
      page.getByRole("heading", { name: "Thought map", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("A map where remaining thoughts connect to each other"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Map" })).toBeVisible();
    await expect(page.getByRole("button", { name: "List" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Revisit" })).toBeVisible();
    await page.getByRole("button", { name: "List" }).click();
    await expect(page.getByText("Mom birthday idea").first()).toBeVisible();

    await page.screenshot({ path: "qa-ia/03-thought-map-shell.png" });

    await page.getByRole("link", { name: /^Thoughts$/ }).click();
    await expect(page).toHaveURL("/");

    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    const archive = await readGuestList(page, GUEST_ARCHIVE_KEY);
    expect(schedules.length).toBe(1);
    expect((schedules[0] as { text: string }).text).toBe("Buy flowers for Mom");
    expect(archive.length).toBe(1);
    expect((archive[0] as { text: string }).text).toBe("Mom birthday idea");
  });
});
