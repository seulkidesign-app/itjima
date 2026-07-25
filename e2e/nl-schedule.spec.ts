import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  GUEST_ARCHIVE_KEY,
  GUEST_SCHEDULE_KEY,
  gotoScheduleUpcoming,
} from "./helpers";

async function submitThought(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.getByRole("button", { name: "Drop it", exact: true }).click();
  await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
}

test.describe("Natural language scheduling", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("high confidence schedule confirms in one tap", async ({ page }) => {
    await submitThought(page, "Dentist tomorrow at 3pm");
    const frame = phone(page);
    const promise = frame.getByTestId("inline-promise").last();
    await expect(promise).toBeVisible();
    await expect(promise).toHaveAttribute("data-intent", "schedule_exact");
    await expect(promise).toHaveAttribute("data-confidence", "high");
    await promise.getByTestId("promise-primary").click();

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(0);
    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    expect(schedules.length).toBe(1);

    await gotoScheduleUpcoming(page);
    await expect(frame.getByText(/Dentist/i).first()).toBeVisible();
  });

  test("low confidence asks for a day with chips only", async ({ page }) => {
    await submitThought(page, "Watch it next week or so");
    const frame = phone(page);
    const promise = frame.getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "schedule_clarify");
    await expect(promise.getByTestId("promise-clarify-chips")).toBeVisible();
    await expect(promise.getByTestId("promise-primary")).toHaveCount(0);
    await promise.getByTestId("promise-clarify-weekend").click();

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(0);
    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    expect(schedules.length).toBe(1);
  });

  test("reference note recommends vault", async ({ page }) => {
    await submitThought(page, "Passport number");
    const frame = phone(page);
    const promise = frame.getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "archive");
    await promise.getByTestId("promise-primary").click();

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(0);
    const archive = await readGuestList(page, GUEST_ARCHIVE_KEY);
    expect(archive.length).toBe(1);
  });

  test("task without time adds to schedule without a date", async ({ page }) => {
    await submitThought(page, "Call mom");
    const frame = phone(page);
    const promise = frame.getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "task");
    await promise.getByTestId("promise-primary").click();

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(1);
    expect(inbox[0]?.decision).toBe("later");

    await gotoScheduleUpcoming(page);
    await expect(frame.getByText(/Call mom/i).first()).toBeVisible();
    await expect(frame.getByText("No date").first()).toBeVisible();
  });

  test("plain note does not show promise card", async ({ page }) => {
    await submitThought(page, "Travel");
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
  });
});

test.describe("Natural language scheduling (Korean)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("itjima.")) localStorage.removeItem(k);
      }
      localStorage.setItem("itjima_lang", "ko");
      sessionStorage.clear();
    });
    await page.reload();
    await phone(page).getByRole("link", { name: /^던지기/ }).waitFor({
      state: "visible",
    });
  });

  async function submitThoughtKo(page: Page, text: string) {
    const frame = phone(page);
    await frame.locator("textarea").first().fill(text);
    await frame.getByRole("button", { name: "던지기", exact: true }).click();
    await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
  }

  test("high confidence Korean schedule confirms in one tap", async ({ page }) => {
    await submitThoughtKo(page, "내일 3시에 치과");
    const frame = phone(page);
    const promise = frame.getByTestId("inline-promise").last();
    await expect(promise).toBeVisible();
    await expect(promise).toHaveAttribute("data-intent", "schedule_exact");
    await expect(promise).toHaveAttribute("data-confidence", "high");
    await promise.getByTestId("promise-primary").click();

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(0);
    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    expect(schedules.length).toBe(1);

    await frame.getByRole("link", { name: /^일정/ }).click();
    await frame.getByRole("tab", { name: "예정" }).click();
    await expect(frame.getByText(/치과/i).first()).toBeVisible();
  });

  test("low confidence Korean asks for a day with chips only", async ({ page }) => {
    await submitThoughtKo(page, "다음주쯤 보기");
    const frame = phone(page);
    const promise = frame.getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "schedule_clarify");
    await expect(promise.getByTestId("promise-clarify-chips")).toBeVisible();
    await expect(promise.getByTestId("promise-primary")).toHaveCount(0);
    await promise.getByTestId("promise-clarify-next_week").click();

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(0);
    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    expect(schedules.length).toBe(1);
  });

  test("Korean reference note recommends vault", async ({ page }) => {
    await submitThoughtKo(page, "여권 번호");
    const frame = phone(page);
    const promise = frame.getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "archive");
    await promise.getByTestId("promise-primary").click();

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(0);
    const archive = await readGuestList(page, GUEST_ARCHIVE_KEY);
    expect(archive.length).toBe(1);
  });

  test("Korean task without time adds to schedule without a date", async ({ page }) => {
    await submitThoughtKo(page, "엄마한테 전화하기");
    const frame = phone(page);
    const promise = frame.getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "task");
    await promise.getByTestId("promise-primary").click();

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(1);
    expect(inbox[0]?.decision).toBe("later");

    await frame.getByRole("link", { name: /^일정/ }).click();
    await frame.getByRole("tab", { name: "예정" }).click();
    await expect(frame.getByText(/엄마한테 전화하기/i).first()).toBeVisible();
    await expect(frame.getByText("날짜 없음").first()).toBeVisible();
  });
});
