import { expect, test } from "@playwright/test";
import {
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  phone,
  readGuestList,
  resetAppState,
} from "./helpers";

test("one clear sentence becomes the exact schedule and reminder shown to the user", async ({
  page,
}) => {
  await resetAppState(page);
  await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
  await page.reload();

  const text = "다음 주 금요일 오후 6시 치과. 전날에도 알려줘";
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
  const startMs = Date.parse(saved.start_time);
  const alarmMs = Date.parse(saved.alarm_at ?? "");

  expect(saved.text).toBe("치과");
  expect(saved.alarm).toBe(true);
  expect(saved.repeat ?? null).toBeNull();
  expect(saved.raw_text).toBe(text);
  expect(Number.isFinite(startMs)).toBe(true);
  expect(Number.isFinite(alarmMs)).toBe(true);
  expect(startMs - alarmMs).toBe(24 * 60 * 60 * 1000);

  const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
    text: string;
  }>;
  expect(inbox.some((item) => item.text === text)).toBe(false);
});

test("a conversational after-work phrase asks only the missing time and preserves the original sentence", async ({
  page,
}) => {
  await resetAppState(page);
  await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
  await page.reload();

  const original = "다음 주 금요일 퇴근하고 치과. 전날에도 알려줘";
  const frame = phone(page);
  const input = frame.locator("textarea").first();
  await input.fill(original);
  await input.press("Control+Enter");

  const clarification = frame.getByTestId("inline-promise");
  await expect(clarification).toBeVisible();
  await expect(clarification).toHaveAttribute("data-needs-confirmation", "true");
  await expect(
    clarification.getByTestId("promise-confirm-after_work_18"),
  ).toBeVisible();
  await expect(
    clarification.getByTestId("promise-confirm-after_work_19"),
  ).toBeVisible();

  await clarification.getByTestId("promise-confirm-after_work_18").click();

  await expect
    .poll(async () => (await readGuestList(page, GUEST_SCHEDULE_KEY)).length)
    .toBe(1);
  const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<{
    text: string;
    start_time: string;
    alarm: boolean;
    alarm_at?: string | null;
    raw_text?: string | null;
  }>;
  const saved = schedules[0];
  const startMs = Date.parse(saved.start_time);
  const alarmMs = Date.parse(saved.alarm_at ?? "");

  expect(saved.text).toBe("치과");
  expect(saved.raw_text).toBe(original);
  expect(saved.alarm).toBe(true);
  expect(Number.isFinite(startMs)).toBe(true);
  expect(Number.isFinite(alarmMs)).toBe(true);
  expect(startMs - alarmMs).toBe(24 * 60 * 60 * 1000);
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
