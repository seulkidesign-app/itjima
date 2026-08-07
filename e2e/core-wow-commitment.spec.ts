import { expect, test } from "@playwright/test";
import {
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  phone,
  readGuestList,
  resetAppState,
} from "./helpers";

test("one messy sentence becomes the exact schedule and reminder shown to the user", async ({
  page,
}) => {
  await resetAppState(page);
  await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
  await page.reload();

  const text = "다음 주 금요일 퇴근하고 치과. 전날에도 알려줘";
  const frame = phone(page);
  const input = frame.locator("textarea").first();
  await input.fill(text);
  await input.focus();
  await input.press("Control+Enter");

  const card = frame.getByTestId("schedule-commitment-card");
  await expect(card).toBeVisible();
  await expect(card.getByTestId("commitment-title")).toHaveText("치과");
  await expect(card.getByTestId("commitment-time")).toContainText("6:00");
  await expect(card.getByTestId("commitment-reminder")).toHaveText("전날");
  await expect(card).toHaveAttribute("data-reminder", "1440");

  await card.getByTestId("commitment-confirm").click();

  await expect
    .poll(async () => (await readGuestList(page, GUEST_SCHEDULE_KEY)).length)
    .toBe(1);

  const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<{
    text: string;
    start_time: string;
    alarm: boolean;
    alarm_at?: string | null;
    repeat?: string | null;
    raw_text?: string | null;
  }>;
  const saved = schedules[0];
  const start = new Date(saved.start_time);
  const alarmAt = new Date(saved.alarm_at ?? "");

  expect(saved.text).toBe("치과");
  expect(saved.alarm).toBe(true);
  expect(saved.repeat ?? null).toBeNull();
  expect(saved.raw_text).toContain("다음 주 금요일");
  expect(start.getDay()).toBe(5);
  expect(start.getHours()).toBe(18);
  expect(start.getTime() - alarmAt.getTime()).toBe(24 * 60 * 60 * 1000);

  const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
    text: string;
  }>;
  expect(inbox.some((item) => item.text === text)).toBe(false);
});

test("timed plans default to an honest at-start reminder and can be adjusted before saving", async ({
  page,
}) => {
  await resetAppState(page);

  const frame = phone(page);
  const input = frame.locator("textarea").first();
  await input.fill("Dentist tomorrow at 3pm");
  await input.press("Control+Enter");

  const card = frame.getByTestId("schedule-commitment-card");
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("data-reminder", "0");
  await expect(card.getByTestId("commitment-reminder")).toHaveText("At start");

  await card.getByTestId("commitment-adjust").click();
  await expect(page.getByRole("dialog").last()).toBeVisible();
});
