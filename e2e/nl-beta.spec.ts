import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
} from "./helpers";

async function installAnalyticsSpy(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents = [];
    window.gtag = (...args: unknown[]) => {
      (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents.push(args);
    };
  });
}

async function readAnalytics(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents ?? [],
  );
}

async function submitKo(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.getByRole("button", { name: "남기기", exact: true }).click();
}

test.describe("Focused natural-language guards", () => {
  test.beforeEach(async ({ page }) => {
    await installAnalyticsSpy(page);
    await resetAppState(page);
    await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
    await page.reload();
  });

  test("ambiguous interpretation stays askable after reload", async ({ page }) => {
    await submitKo(page, "내일 3시 반 치과");
    const frame = phone(page);
    const promise = frame.getByTestId("inline-promise").last();
    await expect(promise).toBeVisible();
    await expect(promise).toContainText("치과");
    await expect(promise).toHaveAttribute("data-confirmation-reason", "assumed_meridiem");
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{ id: string }>;
    expect(inbox).toHaveLength(1);
    await page.reload();
    const after = frame.getByTestId("inline-promise").last();
    await expect(after).toBeVisible();
    await expect(after).toContainText("치과");
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(0);
  });

  test("double tap high-confidence capture creates one event", async ({ page }) => {
    const frame = phone(page);
    await frame.locator("textarea").first().fill("내일 오후 3시에 치과");
    const submit = frame.getByRole("button", { name: "남기기", exact: true });
    await submit.dblclick();
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key) || "[]").length === 1,
      GUEST_SCHEDULE_KEY,
    );
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(0);
  });

  test("capture never opens a calendar automatically", async ({ page }) => {
    await submitKo(page, "내일 오후 3시에 치과");
    await expect(phone(page).getByTestId("saved-schedule-feedback")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("analytics never include captured text", async ({ page }) => {
    const secret = "SECRET-999 내일 오후 3시 회의";
    await submitKo(page, secret);
    await expect(phone(page).getByTestId("saved-schedule-feedback")).toBeVisible();
    const blob = JSON.stringify(await readAnalytics(page));
    expect(blob).not.toContain(secret);
    expect(blob).not.toContain("SECRET-999");
    expect(blob).toContain("nl_thought_submitted");
  });

  test("debug UI stays unavailable even with a query flag", async ({ page }) => {
    await page.goto("/app?nlDebug=1");
    await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
    await page.reload();
    await submitKo(page, "내일 오후 3시에 치과");
    await expect(phone(page).getByTestId("nl-debug-panel")).toHaveCount(0);
  });

  test("plain notes remain in Capture without an interpretation card", async ({ page }) => {
    await submitKo(page, "오늘 커피가 맛있었다");
    await expect(
      phone(page).getByText("오늘 커피가 맛있었다", { exact: true }).first(),
    ).toBeVisible();
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
  });
});
