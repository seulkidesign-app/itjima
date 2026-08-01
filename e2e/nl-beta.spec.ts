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

async function submitThoughtKo(page: Page, text: string) {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
  await page.reload();
  const frame = phone(page);
  await frame.getByRole("link", { name: /^남기기$/ }).waitFor({ state: "visible" });
  await frame.locator("textarea").first().fill(text);
  await frame.getByRole("button", { name: "남기기", exact: true }).click();
  await frame.getByText(text.split("\n")[0]!, { exact: true }).first().waitFor({
    state: "visible",
  });
}

test.describe("NL beta guards", () => {
  test.beforeEach(async ({ page }) => {
    await installAnalyticsSpy(page);
    await resetAppState(page);
    await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
    await page.reload();
  });

  test("dismissed Brain Mirror stays hidden after reload", async ({ page }) => {
    const frame = phone(page);
    await frame.locator("textarea").first().fill("내일 3시에 치과");
    await frame.getByRole("button", { name: "남기기", exact: true }).click();
    const promise = frame.getByTestId("inline-promise").last();
    await promise.getByTestId("promise-manual").click();
    await promise
      .getByTestId("promise-edit-menu")
      .getByRole("button", { name: "그대로 두기", exact: true })
      .click();
    await expect(frame.getByTestId("inline-promise")).toHaveCount(0);
    const ackRaw = await page.evaluate(() =>
      localStorage.getItem("itjima.nl.acknowledged.guest"),
    );
    expect(ackRaw).toBeTruthy();
    await page.reload();
    await frame
      .locator(".whitespace-pre-wrap")
      .filter({ hasText: "내일 3시에 치과" })
      .first()
      .waitFor({ state: "visible" });
    await expect(frame.getByTestId("inline-promise")).toHaveCount(0);
  });

  test("double-tap schedule confirm creates only one event", async ({ page }) => {
    const frame = phone(page);
    await frame.locator("textarea").first().fill("내일 3시에 치과");
    await frame.getByRole("button", { name: "남기기", exact: true }).click();
    const promise = frame.getByTestId("inline-promise").last();
    const btn = promise.getByTestId("promise-primary");
    await btn.dblclick();
    await page.waitForTimeout(600);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("calendar never opens automatically on capture", async ({ page }) => {
    const frame = phone(page);
    await frame.locator("textarea").first().fill("내일 3시에 치과");
    await frame.getByRole("button", { name: "남기기", exact: true }).click();
    await frame.getByTestId("inline-promise").last().waitFor({ state: "visible" });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("nl analytics never include thought text", async ({ page }) => {
    const secret = "여권 번호 SECRET-999";
    const frame = phone(page);
    await frame.locator("textarea").first().fill(secret);
    await frame.getByRole("button", { name: "남기기", exact: true }).click();
    await frame.getByTestId("inline-promise").last().waitFor({ state: "visible" });
    const events = await readAnalytics(page);
    const blob = JSON.stringify(events);
    expect(blob).not.toContain(secret);
    expect(blob).not.toContain("SECRET-999");
    expect(blob).toContain("nl_thought_submitted");
    expect(blob).toContain("nl_brain_mirror_shown");
  });

  test("debug panel hidden without nlDebug param", async ({ page }) => {
    const frame = phone(page);
    await frame.locator("textarea").first().fill("내일 3시에 치과");
    await frame.getByRole("button", { name: "남기기", exact: true }).click();
    await frame.getByTestId("inline-promise").last().waitFor({ state: "visible" });
    await expect(frame.getByTestId("nl-debug-panel")).toHaveCount(0);
  });

  test("debug panel visible with nlDebug=1 in E2E build", async ({ page }) => {
    await page.goto("/?nlDebug=1");
    await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
    await page.reload();
    const frame = phone(page);
    await frame.locator("textarea").first().fill("내일 3시에 치과");
    await frame.getByRole("button", { name: "남기기", exact: true }).click();
    await expect(frame.getByTestId("nl-debug-panel").last()).toBeVisible();
  });

  test("parse failure keeps thought in inbox", async ({ page }) => {
    await page.evaluate(({ key, rows }) => {
      localStorage.setItem(key, JSON.stringify(rows));
    }, {
      key: GUEST_INBOX_KEY,
      rows: [
        {
          id: "no-date-sched",
          text: "치과",
          images: [],
          created_at: new Date().toISOString(),
          status: "active",
        },
      ],
    });
    await page.reload();
    const frame = phone(page);
    await expect(frame.getByTestId("inline-promise")).toHaveCount(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
  });
});
