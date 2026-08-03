import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(metrics.page).toBeLessThanOrEqual(metrics.viewport + 1);
}

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`${viewport.name} landing presents the branded product story without overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/about");

    await expect(page.locator(".marketing-landing")).toBeVisible();
    await expect(page.locator(".marketing-wordmark .itjima-brand-mark")).toBeVisible();
    await expect(page.locator(".marketing-demo-shell")).toBeVisible();
    await expect(page.locator(".marketing-manifesto")).toBeAttached();
    await expect(page.getByRole("link", { name: /Open app|앱 열기/ }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.mouse.wheel(0, 900);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  });
}

test("landing installation education does not block the main app CTA", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/about");

  const openApp = page
    .getByRole("banner")
    .getByRole("link", { name: /Open app|앱 열기/, exact: true });
  await expect(openApp).toBeVisible();
  await openApp.click();
  await expect(page).toHaveURL(/\/$/);
});

test("app home keeps branded navigation and capture controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator(".app-brand-trigger-v2 .itjima-brand-mark")).toBeVisible();
  const tools = page.getByRole("button", { name: "Attachment tools" });
  await expect(tools).toBeVisible();
  await tools.click();
  await expect(tools).toHaveAttribute("aria-expanded", "true");
});

test("brand motion respects reduced-motion preference", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/about");

  const animationName = await page
    .locator(".marketing-demo-message")
    .evaluate((element) => getComputedStyle(element).animationName);
  expect(animationName).toBe("none");

  await context.close();
});
