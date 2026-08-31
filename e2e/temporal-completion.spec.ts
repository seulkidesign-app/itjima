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
  await phone(page)
    .getByRole("link", { name: /^(남기기|Capture)/ })
    .waitFor();
}

async function submit(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame
    .getByRole("button", { name: /^(남기기|던지기)$/, exact: false })
    .click();
}

async function schedules(page: Page) {
  return (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<{
    text?: string;
    raw_text?: string | null;
    all_day?: boolean;
    start_all_day?: boolean;
    end_all_day?: boolean;
    start_time?: string;
    source_id?: string | null;
  }>;
}

async function inbox(page: Page) {
  return (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
    text?: string;
    temporal_state?: string | null;
    start_time?: string | null;
    clarification_state?: string | null;
  }>;
}

test.describe("Temporal completion UX", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await resetKo(page);
  });

  test("date-only capture completes without inventing a clock", async ({ page }) => {
    await submit(page, "내일 운동");

    await expect(phone(page).getByTestId("saved-schedule-feedback")).toBeVisible();
    await expect
      .poll(async () => (await schedules(page)).filter((s) => s.raw_text === "내일 운동").length)
      .toBe(1);

    const [schedule] = (await schedules(page)).filter(
      (s) => s.raw_text === "내일 운동",
    );
    expect(schedule.all_day).toBe(true);
    expect(schedule.start_all_day).toBe(true);
    expect(schedule.end_all_day).toBe(true);
    expect(new Date(schedule.start_time ?? "").getHours()).toBe(0);

    const [record] = (await inbox(page)).filter((item) => item.text === "내일 운동");
    expect(record.temporal_state).toBe("date_only");
    expect(record.start_time).toBeTruthy();
  });

  test("date plus daypart preserves fuzzy precision instead of a fake clock", async ({ page }) => {
    await submit(page, "내일 오후 운동");

    await expect(phone(page).getByTestId("saved-schedule-feedback")).toBeVisible();
    await expect(phone(page).getByTestId("saved-schedule-when")).toContainText("오후");

    const [record] = (await inbox(page)).filter(
      (item) => item.text === "내일 오후 운동",
    );
    expect(record.temporal_state).toBe("fuzzy_time");
    expect(new Date(record.start_time ?? "").getHours()).toBe(0);
  });

  test("standalone daypart asks only for the missing date", async ({ page }) => {
    const before = (await schedules(page)).length;
    await submit(page, "오후에 운동");

    const promise = phone(page).getByTestId("inline-promise").filter({
      hasText: "오후에 운동",
    });
    await expect(promise).toBeVisible();
    await expect(promise).toHaveAttribute("data-clarify-missing", "day");
    await expect(promise).toContainText("언제 오후인가요?");
    await expect(promise.getByRole("button", { name: "오늘" })).toBeVisible();
    await expect(promise.getByRole("button", { name: "내일" })).toBeVisible();
    expect((await schedules(page)).length).toBe(before);
  });

  test("이따가 keeps today and asks only for time", async ({ page }) => {
    const before = (await schedules(page)).length;
    await submit(page, "이따가 운동");

    const promise = phone(page).getByTestId("inline-promise").filter({
      hasText: "이따가 운동",
    });
    await expect(promise).toBeVisible();
    await expect(promise).toHaveAttribute("data-clarify-missing", "time");
    await expect(promise).toContainText("오늘 몇 시쯤 할까요?");
    await expect(promise.getByTestId("promise-pick-time")).toBeVisible();
    await expect(promise.getByTestId("promise-no-time-today")).toBeVisible();
    expect((await schedules(page)).length).toBe(before);
  });
});
