import { test, expect, type Page } from "@playwright/test";
import { phone } from "./helpers";

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
  await phone(page).getByRole("link", { name: /^(남기기|Capture)$/ }).waitFor();
}

async function submit(page: Page, text: string) {
  const frame = phone(page);
  const input = frame.locator("#capture-input");
  await input.fill(text);
  await frame.getByTestId("capture-submit").click();
  await frame
    .locator(
      '[data-testid="left-item-row"], [data-testid="saved-schedule-feedback"], [data-testid="inline-promise"]',
    )
    .last()
    .waitFor({ state: "visible" });
}

test.describe("POST-66 real-device Figma 319 fidelity", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await resetKo(page);
  });

  test("empty Home is quiet and keeps one compact capture pill", async ({ page }) => {
    const frame = phone(page);
    const hero = frame.getByTestId("home-empty-hero");
    await expect(hero).toBeVisible();
    await expect(frame.locator(".mobile-app-header")).toBeVisible();

    const legacyGlow = await hero.evaluate((element) => {
      const style = getComputedStyle(element, "::before");
      return {
        display: style.display,
        backgroundImage: style.backgroundImage,
        content: style.content,
      };
    });
    expect(legacyGlow.display === "none" || legacyGlow.content === "none").toBe(true);
    expect(legacyGlow.backgroundImage).toBe("none");

    const shell = frame.locator("form.composer-hero .input-shell").first();
    const shellBox = await shell.boundingBox();
    expect(shellBox).toBeTruthy();
    expect(shellBox!.height).toBeLessThanOrEqual(58);

    const form = frame.locator("form.composer-hero").first();
    const formStyle = await form.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderTopWidth: style.borderTopWidth,
        boxShadow: style.boxShadow,
      };
    });
    expect(formStyle.borderTopWidth).toBe("0px");
    expect(formStyle.boxShadow).toBe("none");
  });

  test("Schedule owns one compact header and quiet card hierarchy", async ({ page }) => {
    const frame = phone(page);
    await submit(page, "내일 오후 3시 치과");
    await frame.getByRole("link", { name: /^(일정|Schedule)$/ }).click();

    await expect(frame.getByRole("heading", { name: "내 일정" })).toBeVisible();
    await expect(frame.locator(".mobile-app-header")).toBeHidden();
    await expect(frame.getByTestId("schedule-open-search")).toBeVisible();

    const visibleSearchCount = await frame
      .locator(
        '[data-testid="open-browse-search"]:visible, [data-testid="schedule-open-search"]:visible',
      )
      .count();
    expect(visibleSearchCount).toBe(1);

    const view = frame.getByTestId("schedule-unified-view");
    const viewBackground = await view.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(viewBackground).toBe("rgb(255, 255, 255)");

    const row = frame.getByTestId("schedule-compact-row").filter({ hasText: "치과" });
    await expect(row).toBeVisible();
    const rowBox = await row.boundingBox();
    expect(rowBox).toBeTruthy();
    expect(rowBox!.height).toBeLessThanOrEqual(64);

    const metaSize = await row
      .locator(".schedule-row-meta")
      .evaluate((element) => getComputedStyle(element).fontSize);
    const titleSize = await row
      .locator(".schedule-row-title")
      .evaluate((element) => getComputedStyle(element).fontSize);
    expect(metaSize).toBe("12px");
    expect(titleSize).toBe("14px");
  });
});
