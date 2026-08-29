import { expect, test } from "@playwright/test";
import { addThought, phone, resetAppState } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetAppState(page);
  await page.evaluate(() =>
    localStorage.setItem("itjima.swipe.tutorial.done", "1"),
  );
});

test("Landing V2 and app keep the intended UI while Home motion stays active", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?lang=ko");

  await expect(
    page.getByRole("heading", { name: /메모·할 일·일정.*구분하지 말고 한 문장으로/ }),
  ).toBeVisible();
  await expect(page.locator(".landing-v2")).toHaveAttribute(
    "data-landing-version",
    "2",
  );
  await expect(page.locator(".marketing-landing")).toHaveCount(0);
  await expect(page.locator(".itjima-brand-mark")).toHaveCount(0);
  await expect(page.locator(".lv2-hero-demo-wrap")).toBeVisible();

  await page
    .getByRole("banner")
    .getByRole("link", { name: "앱 열기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.locator(".app-brand-trigger:visible")).toContainText(
    /잊지마|Itjima/i,
  );
  await expect(
    page.locator(".app-brand-trigger .itjima-brand-mark"),
  ).toHaveCount(0);

  await addThought(page, `모션 유지 ${Date.now()}`);
  const newestRow = phone(page).locator(
    '[data-testid="left-item-row"][data-newest="true"]',
  );
  await expect(newestRow).toBeVisible();
});

test("Landing V2 respects reduced-motion preference", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/?lang=ko");

  const landing = page.locator(".landing-v2");
  await expect(landing).toHaveAttribute("data-landing-version", "2");
  await expect(page.locator(".lv2-hero-copy")).toBeVisible();

  const transitionDurationMs = await page.locator(".lv2-nav-cta").evaluate((element) => {
    const raw = getComputedStyle(element).transitionDuration.split(",")[0]?.trim() ?? "0s";
    if (raw.endsWith("ms")) return Number.parseFloat(raw);
    if (raw.endsWith("s")) return Number.parseFloat(raw) * 1000;
    return Number.parseFloat(raw) || 0;
  });
  expect(transitionDurationMs).toBeLessThanOrEqual(1);

  await context.close();
});

test("pre-brand Capture menu no longer opens DecisionDeck (M2)", async ({
  page,
}) => {
  await addThought(page, `카드 모션 유지 ${Date.now()}`);
  const app = phone(page);
  await app.getByTestId("left-item-more").last().click();
  const menu = page.getByTestId("inbox-context-menu");
  await expect(
    menu.getByRole("menuitem", { name: /Sort one by one|하나씩 정리하기/i }),
  ).toHaveCount(0);
  await expect(app.getByTestId("decision-deck-active-card")).toHaveCount(0);
});