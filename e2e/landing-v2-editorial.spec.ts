import { expect, test } from "@playwright/test";

test.describe("Landing V2 editorial system", () => {
  test("uses English Playpen Sans wordmarks and removes decorative circles", async ({ page }) => {
    await page.goto("/?lang=en");

    const navBrand = page.locator(".lv2-brand");
    const masthead = page.locator(".lv2-brand-masthead");
    await expect(navBrand).toBeVisible();
    await masthead.scrollIntoViewIfNeeded();

    const visualBrand = await navBrand.evaluate((node) => {
      const style = getComputedStyle(node, "::after");
      return { content: style.content, family: style.fontFamily };
    });
    expect(visualBrand.content).toContain("Itjima");
    expect(visualBrand.family).toContain("Playpen Sans");

    const visualMasthead = await masthead.evaluate((node) => {
      const style = getComputedStyle(node, "::after");
      return { content: style.content, color: style.color, family: style.fontFamily };
    });
    expect(visualMasthead.content).toContain("Itjima");
    expect(visualMasthead.color).toBe("rgb(255, 255, 255)");
    expect(visualMasthead.family).toContain("Playpen Sans");

    await expect(page.locator(".lv2-brand-dot")).toBeHidden();
    await expect(page.locator(".lv2-rule-dot").first()).toBeHidden();
    await expect(page.locator(".lv2-hero-glow").first()).toBeHidden();

    const footerBottom = await page.locator(".lv2-footer").evaluate((node) => node.getBoundingClientRect().bottom + window.scrollY);
    const brandTop = await page.locator(".lv2-brand-band").evaluate((node) => node.getBoundingClientRect().top + window.scrollY);
    expect(brandTop).toBeGreaterThanOrEqual(footerBottom - 2);
  });

  test("mobile product carousel stays inside a white section and scrolls internally", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?lang=ko");

    const product = page.locator(".lv2-product");
    const track = page.locator(".lv2-product-track");
    await product.scrollIntoViewIfNeeded();

    await expect(product).toHaveCSS("background-color", "rgb(255, 255, 255)");

    const geometry = await page.evaluate(() => {
      const track = document.querySelector<HTMLElement>(".lv2-product-track")!;
      return {
        docClient: document.documentElement.clientWidth,
        docScroll: document.documentElement.scrollWidth,
        trackClient: track.clientWidth,
        trackScroll: track.scrollWidth,
      };
    });

    expect(geometry.docScroll).toBeLessThanOrEqual(geometry.docClient + 1);
    expect(geometry.trackClient).toBeLessThanOrEqual(geometry.docClient);
    expect(geometry.trackScroll).toBeGreaterThan(geometry.trackClient);
  });
});
