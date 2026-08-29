import { expect, test } from "@playwright/test";

test.describe("Landing V2 polish", () => {
  test("desktop nav, brand signoff and social links stay intact", async ({ page }) => {
    await page.goto("/?lang=en");

    const nav = page.locator(".lv2-nav");
    await expect(nav).toBeVisible();
    await expect(page.getByRole("link", { name: "Itjima home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "How it works" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open app" })).toBeVisible();

    const productCard = page.locator(".lv2-product-card").first();
    await productCard.scrollIntoViewIfNeeded();
    await expect(productCard).toBeVisible();
    await expect(productCard).toHaveCSS("border-top-width", "0px");

    const masthead = page.locator(".lv2-brand-masthead");
    await masthead.scrollIntoViewIfNeeded();
    await expect(masthead).toHaveText("잊지마");

    await expect(page.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://www.instagram.com/itjima.app");
    await expect(page.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", "https://www.linkedin.com/company/itjima");
  });

  test("mobile does not overflow horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?lang=ko");

    await expect(page.locator(".lv2-brand-masthead")).toBeAttached();
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });
});
