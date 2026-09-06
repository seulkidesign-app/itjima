import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";
import { phone, dismissInlinePromise } from "./helpers";

const OUT_DIR = join(process.cwd(), "e2e-screenshots", "portfolio");

async function resetKo(page: Page) {
  await page.goto("/app");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("itjima.")) localStorage.removeItem(key);
    }
    localStorage.setItem("itjima_lang", "ko");
    localStorage.setItem("itjima.swipe.tutorial.done", "1");
    sessionStorage.clear();
  });
  await page.reload();
  await phone(page)
    .getByRole("link", { name: /^(남기기|Capture)/ })
    .waitFor({ state: "visible" });
}

async function submit(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame
    .getByRole("button", { name: /^(남기기|던지기)$/, exact: false })
    .click();
  await frame
    .locator(
      '[data-testid="left-item-row"], [data-testid="saved-schedule-feedback"], [data-testid="inline-promise"], [data-testid="chat-turn"]',
    )
    .last()
    .waitFor({ state: "visible" });
  await page.waitForTimeout(350);
}

test.describe("Portfolio real UI captures", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.setTimeout(120_000);

  test("capture contextual current V02 mobile states", async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true });
    await resetKo(page);
    const frame = phone(page);

    // Cover: real ambiguity-resolution flow.
    await submit(page, "내일 3시 반 치과");
    const ambiguity = frame.getByTestId("inline-promise").last();
    await expect(ambiguity).toBeVisible();
    await expect(ambiguity).toHaveAttribute(
      "data-confirmation-reason",
      "assumed_meridiem",
    );
    await ambiguity.scrollIntoViewIfNeeded();
    await frame.screenshot({
      path: join(OUT_DIR, "01-cover-ambiguous-schedule.png"),
    });

    await ambiguity.getByTestId("promise-confirm-afternoon").click();
    await expect(frame.getByTestId("saved-schedule-feedback")).toBeVisible();
    await page.waitForTimeout(250);
    await frame.screenshot({
      path: join(OUT_DIR, "02-cover-resolved-schedule.png"),
    });

    // Product Overview: believable everyday records created through the real composer.
    for (const text of [
      "치과 예약금 보내기",
      "엄마 생신 선물 보기",
      "여행 준비물 정리",
      "금요일 오후 7시 민지 만나기",
    ]) {
      await submit(page, text);
      await dismissInlinePromise(page);
    }
    await page.waitForTimeout(300);
    await frame.screenshot({
      path: join(OUT_DIR, "03-overview-contextual-home.png"),
    });

    // V02 validation: clean natural-language input and its actual interpreted result.
    await resetKo(page);
    const composer = frame.locator("textarea").first();
    await composer.fill("9월 12일 저녁 6시 수진 만나기");
    await composer.focus();
    await page.waitForTimeout(250);
    await frame.screenshot({
      path: join(OUT_DIR, "04-v02-natural-input.png"),
    });

    await frame
      .getByRole("button", { name: /^(남기기|던지기)$/, exact: false })
      .click();
    await frame
      .locator(
        '[data-testid="saved-schedule-feedback"], [data-testid="inline-promise"], [data-testid="left-item-row"]',
      )
      .last()
      .waitFor({ state: "visible" });
    await page.waitForTimeout(350);
    await frame.screenshot({
      path: join(OUT_DIR, "05-v02-interpreted-result.png"),
    });

    // Daily-use state after a few different kinds of records.
    for (const text of [
      "치과 예약금 보내기",
      "엄마 생신 선물 보기",
      "여행 준비물 정리",
      "다음 주 화요일 오전 10시 포트폴리오 수정",
      "러닝화 세탁하기",
    ]) {
      await submit(page, text);
      await dismissInlinePromise(page);
    }
    await page.waitForTimeout(300);
    await frame.screenshot({
      path: join(OUT_DIR, "06-v02-daily-use.png"),
    });

    // Schedule tab with the exact schedules created above.
    const scheduleLink = frame
      .getByRole("link", { name: /일정|Schedule/ })
      .first();
    if (await scheduleLink.isVisible().catch(() => false)) {
      await scheduleLink.click();
      await page.waitForTimeout(350);
      await frame.screenshot({
        path: join(OUT_DIR, "07-v02-schedule.png"),
      });
    }
  });
});
