import { test, expect, type Page } from "@playwright/test";
import {
  phone,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  readGuestList,
} from "./helpers";

async function resetKo(page: Page) {
  await page.goto("/app");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("itjima.")) localStorage.removeItem(key);
    }
    localStorage.setItem("itjima_lang", "ko");
    sessionStorage.clear();
  });
  await page.reload();
  await phone(page).getByRole("link", { name: /^남기기$/ }).waitFor();
}

async function submit(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame
    .getByRole("button", { name: /^(남기기|던지기)$/, exact: false })
    .click();
}

test.describe("Temporal Completion UX", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await resetKo(page);
  });

  test("date-only input becomes an all-day schedule without asking for a clock", async ({ page }) => {
    await submit(page, "내일 운동");

    const feedback = phone(page).getByTestId("saved-schedule-feedback");
    await expect(feedback).toBeVisible();
    await expect(feedback.getByTestId("saved-schedule-when")).toContainText("종일");
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);

    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<{
      text?: string;
      all_day?: boolean;
      start_all_day?: boolean;
      raw_text?: string | null;
    }>;
    const plan = schedules.find(
      (item) => item.raw_text === "내일 운동" || item.text?.includes("운동"),
    );
    expect(plan).toBeTruthy();
    expect(plan?.all_day ?? plan?.start_all_day).toBe(true);

    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      text?: string;
      temporal_state?: string | null;
      start_time?: string | null;
    }>;
    const canonical = inbox.find((item) => item.text === "내일 운동");
    expect(canonical?.temporal_state).toBe("date_only");
    expect(canonical?.start_time).toBeTruthy();
  });

  test("date plus daypart preserves the fuzzy window on every visible surface", async ({ page }) => {
    await submit(page, "내일 오후 운동");

    const frame = phone(page);
    const feedback = frame.getByTestId("saved-schedule-feedback");
    await expect(feedback).toBeVisible();
    const when = feedback.getByTestId("saved-schedule-when");
    await expect(when).toContainText("오후");
    await expect(when).not.toContainText("종일");
    await expect(when).not.toContainText(/\d{1,2}:\d{2}/);

    const row = frame
      .getByTestId("left-item-row")
      .filter({ hasText: "내일 오후 운동" })
      .first();
    await expect(row).toBeVisible();
    await expect(row.getByTestId("left-item-meta")).toContainText("오후");
    await expect(row.getByTestId("left-item-meta")).not.toContainText("종일");

    await row.getByTestId("left-item-open-detail").click();
    const detail = frame.getByTestId("thought-detail-sheet");
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId("thought-detail-when")).toContainText("오후");
    await expect(detail.getByTestId("thought-detail-when")).not.toContainText("종일");

    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      text?: string;
      temporal_state?: string | null;
      start_time?: string | null;
    }>;
    const canonical = inbox.find((item) => item.text === "내일 오후 운동");
    expect(canonical?.temporal_state).toBe("fuzzy_time");
    expect(canonical?.start_time).toBeTruthy();
  });

  test("standalone daypart asks only for the missing date", async ({ page }) => {
    const before = (await readGuestList(page, GUEST_SCHEDULE_KEY)).length;
    await submit(page, "오후에 운동");

    const promise = phone(page).getByTestId("inline-promise");
    await expect(promise).toBeVisible();
    await expect(promise).toHaveAttribute("data-clarify-missing", "day");
    await expect(promise.getByText(/언제 오후인가요/)).toBeVisible();
    await expect(promise.getByTestId("promise-clarify-today")).toBeVisible();
    await expect(promise.getByTestId("promise-clarify-tomorrow")).toBeVisible();

    const after = (await readGuestList(page, GUEST_SCHEDULE_KEY)).length;
    expect(after).toBe(before);
  });

  test("이따가 keeps today and asks only for time, with a no-time completion path", async ({ page }) => {
    await submit(page, "이따가 운동");

    const promise = phone(page).getByTestId("inline-promise");
    await expect(promise).toBeVisible();
    await expect(promise).toHaveAttribute("data-clarify-missing", "time");
    await expect(promise.getByText(/오늘 몇 시쯤 할까요/)).toBeVisible();
    await expect(promise.getByTestId("promise-pick-time")).toBeVisible();
    await expect(promise.getByTestId("promise-no-time-today")).toBeVisible();

    await promise.getByTestId("promise-no-time-today").click();
    await expect(promise).toHaveCount(0);

    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<{
      text?: string;
      all_day?: boolean;
      start_all_day?: boolean;
      start_time?: string;
    }>;
    const plan = schedules.find((item) => item.text?.includes("이따가 운동"));
    expect(plan).toBeTruthy();
    expect(plan?.all_day ?? plan?.start_all_day).toBe(true);
    expect(plan?.start_time).toBeTruthy();
  });

  test("이따가 time picker stays anchored to today even after generic after-hours defaults", async ({ page }) => {
    await submit(page, "이따가 운동");

    const promise = phone(page).getByTestId("inline-promise");
    await expect(promise).toBeVisible();
    await promise.getByTestId("promise-pick-time").click();

    const flow = phone(page).getByTestId("schedule-choice-flow");
    await expect(flow).toBeVisible();
    await expect(flow.getByRole("button", { name: "오늘", exact: true })).toHaveClass(
      /bg-primary/,
    );
  });
});
