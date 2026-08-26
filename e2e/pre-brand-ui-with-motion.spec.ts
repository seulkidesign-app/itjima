import { expect, test } from "@playwright/test";
import { addThought, phone, resetAppState } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetAppState(page);
  await page.evaluate(() =>
    localStorage.setItem("itjima.swipe.tutorial.done", "1"),
  );
});

test("landing and app use the pre-brand UI while Home motion stays active", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // /about redirects to marketing landing at /
  await page.goto("/?lang=ko");

  await expect(
    page.getByRole("heading", { name: /대충 말해도.*일정이 됩니다/ }),
  ).toBeVisible();
  // Pre-brand landing uses ITJIMA wordmark (CSS may clip the mark box); assert structure only.
  await expect(page.locator(".landing-motion-wordmark")).toHaveCount(1);
  await expect(page.locator(".marketing-landing")).toHaveCount(0);
  await expect(page.locator(".itjima-brand-mark")).toHaveCount(0);
  await expect(page.locator(".landing-motion")).toHaveAttribute(
    "data-motion",
    "ready",
  );
  await expect
    .poll(() =>
      page
        .locator(".landing-motion-message")
        .evaluate((element) => getComputedStyle(element).animationName),
    )
    .toContain("landing-message-pop");

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

test("landing motion respects reduced-motion preference", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/?lang=ko");

  await expect(page.locator(".landing-motion")).toHaveAttribute(
    "data-motion",
    "reduced",
  );
  await expect
    .poll(() =>
      page
        .locator(".landing-motion-message")
        .evaluate((element) => getComputedStyle(element).animationName),
    )
    .toBe("none");
  await expect(page.locator("[data-landing-reveal]").first()).toBeVisible();

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
