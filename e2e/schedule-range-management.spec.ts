import { expect, test, type Page } from "@playwright/test";
import {
  GUEST_SCHEDULE_KEY,
  phone,
  resetAppState,
} from "./helpers";

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function chooseStableTwoDayRange(page: Page) {
  return page.evaluate(() => {
    const now = new Date();
    const useNextMonth = now.getDate() >= 9;
    const start = new Date(
      now.getFullYear(),
      now.getMonth() + (useNextMonth ? 1 : 0),
      10,
      10,
      17,
      0,
      0,
    );
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      11,
      18,
      43,
      0,
      0,
    );
    return {
      startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
      endDate: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      monthOffset: useNextMonth ? 1 : 0,
      startDay: start.getDate(),
      endDay: end.getDate(),
    };
  });
}

test("schedule editor supports exact minutes and a real start-to-end date range", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAppState(page);

  await phone(page).getByRole("link", { name: /^Schedule/ }).click();
  await phone(page)
    .getByRole("button", { name: "Add task", exact: true })
    .click();

  const sheet = page.getByRole("dialog").last();
  await sheet.getByRole("button", { name: "Today" }).click();
  await sheet
    .getByRole("button", { name: "Add time and end" })
    .click();

  const range = await chooseStableTwoDayRange(page);
  const title = `Two-day planning ${Date.now()}`;

  await sheet.getByLabel("Schedule title").fill(title);
  await sheet.getByLabel("Start date").fill(range.startDate);
  await sheet.getByLabel("Start time").fill("10:17");
  await sheet.getByLabel("End date").fill(range.endDate);
  await sheet.getByLabel("End time").fill("18:43");

  await expect(sheet.getByText(/10:17/)).toBeVisible();
  await expect(sheet.getByText(/18:43/)).toBeVisible();

  await sheet.getByRole("button", { name: "Set a reminder" }).click();
  await sheet.getByRole("button", { name: "No reminder" }).click();
  await sheet.getByRole("button", { name: "Add to schedule" }).click();

  const saved = await page.evaluate(
    ({ key, title }) => {
      const items = JSON.parse(localStorage.getItem(key) || "[]") as Array<{
        text: string;
        start_time: string;
        end_time: string;
      }>;
      return items.find((item) => item.text === title) ?? null;
    },
    { key: GUEST_SCHEDULE_KEY, title },
  );

  expect(saved).not.toBeNull();
  expect(saved?.start_time).toBe(range.startIso);
  expect(saved?.end_time).toBe(range.endIso);

  await phone(page).getByRole("tab", { name: "Calendar" }).click();
  for (let i = 0; i < range.monthOffset; i += 1) {
    await phone(page).getByRole("button", { name: "Next month" }).click();
  }

  const span = phone(page)
    .locator(".calendar-span-bar")
    .filter({ hasText: title })
    .first();
  await expect(span).toBeVisible();

  const widthCheck = await page.evaluate(
    ({ startDay, endDay, title }) => {
      const startCell = document.querySelector<HTMLElement>(
        `[data-cal-day="${startDay}"]`,
      );
      const endCell = document.querySelector<HTMLElement>(
        `[data-cal-day="${endDay}"]`,
      );
      const bars = Array.from(
        document.querySelectorAll<HTMLElement>(".calendar-span-bar"),
      );
      const bar = bars.find((candidate) =>
        candidate.textContent?.includes(title),
      );
      if (!startCell || !endCell || !bar) return null;
      const startRect = startCell.getBoundingClientRect();
      const endRect = endCell.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      return {
        expectedLeft: startRect.left,
        expectedRight: endRect.right,
        actualLeft: barRect.left,
        actualRight: barRect.right,
        singleCellWidth: startRect.width,
        barWidth: barRect.width,
      };
    },
    { startDay: range.startDay, endDay: range.endDay, title },
  );

  expect(widthCheck).not.toBeNull();
  expect(widthCheck!.barWidth).toBeGreaterThan(
    widthCheck!.singleCellWidth * 1.7,
  );
  expect(Math.abs(widthCheck!.actualLeft - widthCheck!.expectedLeft)).toBeLessThan(
    10,
  );
  expect(
    Math.abs(widthCheck!.actualRight - widthCheck!.expectedRight),
  ).toBeLessThan(10);
});

test("all-day ranges include both the start and end date", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAppState(page);

  await phone(page).getByRole("link", { name: /^Schedule/ }).click();
  await phone(page)
    .getByRole("button", { name: "Add task", exact: true })
    .click();

  const sheet = page.getByRole("dialog").last();
  await sheet.getByRole("button", { name: "Today" }).click();
  await sheet
    .getByRole("button", { name: "Add time and end" })
    .click();

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 4);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 5);
  const title = `Inclusive all-day range ${Date.now()}`;

  await sheet.getByLabel("Schedule title").fill(title);
  await sheet.getByRole("switch", { name: "All day" }).click();
  await sheet.getByLabel("Start date").fill(localDateValue(start));
  await sheet.getByLabel("End date").fill(localDateValue(end));
  await expect(sheet.getByText(/2 days · All day/)).toBeVisible();

  await sheet.getByRole("button", { name: "Set a reminder" }).click();
  await sheet.getByRole("button", { name: "No reminder" }).click();
  await sheet.getByRole("button", { name: "Add to schedule" }).click();

  const saved = await page.evaluate(
    ({ key, title }) => {
      const items = JSON.parse(localStorage.getItem(key) || "[]") as Array<{
        text: string;
        start_time: string;
        end_time: string;
        all_day?: boolean;
      }>;
      return items.find((item) => item.text === title) ?? null;
    },
    { key: GUEST_SCHEDULE_KEY, title },
  );

  expect(saved?.all_day).toBe(true);
  const savedStart = new Date(saved!.start_time);
  const savedEnd = new Date(saved!.end_time);
  expect(savedStart.getDate()).toBe(4);
  expect(savedStart.getHours()).toBe(0);
  expect(savedEnd.getDate()).toBe(5);
  expect(savedEnd.getHours()).toBe(23);
  expect(savedEnd.getMinutes()).toBe(59);
});
