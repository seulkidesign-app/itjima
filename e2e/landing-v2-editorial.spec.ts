import { expect, test } from "@playwright/test";

test.describe("Landing V2 editorial system", () => {
  test("uses uppercase English Playpen Sans wordmarks with generous hero clearance", async ({ page }) => {
    await page.goto("/?lang=en");

    const nav = page.locator(".lv2-nav");
    const navBrand = page.locator(".lv2-brand");
    const brandDot = page.locator(".lv2-brand-dot");
    const heroHeading = page.locator(".lv2-hero h1");
    const masthead = page.locator(".lv2-brand-masthead");

    await expect(navBrand).toBeVisible();
    await expect(brandDot).toBeVisible();

    const visualBrand = await navBrand.evaluate((node) => {
      const style = getComputedStyle(node, "::after");
      return { content: style.content, family: style.fontFamily, weight: style.fontWeight };
    });
    expect(visualBrand.content).toContain("ITJIMA");
    expect(visualBrand.family).toContain("Playpen Sans");
    expect(visualBrand.weight).toBe("600");

    const clearance = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>(".lv2-nav")!.getBoundingClientRect();
      const heading = document.querySelector<HTMLElement>(".lv2-hero h1")!.getBoundingClientRect();
      return heading.top - nav.bottom;
    });
    expect(clearance).toBeGreaterThanOrEqual(48);

    await masthead.scrollIntoViewIfNeeded();
    const visualMasthead = await masthead.evaluate((node) => {
      const style = getComputedStyle(node, "::after");
      return { content: style.content, color: style.color, family: style.fontFamily, weight: style.fontWeight };
    });
    expect(visualMasthead.content).toContain("ITJIMA");
    expect(visualMasthead.color).toBe("rgb(255, 255, 255)");
    expect(visualMasthead.family).toContain("Playpen Sans");
    expect(visualMasthead.weight).toBe("600");

    await expect(page.locator(".lv2-rule-dot").first()).toBeHidden();
    await expect(page.locator(".lv2-hero-glow").first()).toBeHidden();
    await expect(page.locator(".lv2-footer .lv2-rule-label")).toHaveText("ITJIMA");

    const footerBottom = await page.locator(".lv2-footer").evaluate((node) => node.getBoundingClientRect().bottom + window.scrollY);
    const brandTop = await page.locator(".lv2-brand-band").evaluate((node) => node.getBoundingClientRect().top + window.scrollY);
    expect(brandTop).toBeGreaterThanOrEqual(footerBottom - 2);
  });

  test("mobile product carousel stays inside a bright section and scrolls internally", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?lang=ko");

    const product = page.locator(".lv2-product");
    const track = page.locator(".lv2-product-track");
    await product.scrollIntoViewIfNeeded();

    const productBg = await product.evaluate((node) => getComputedStyle(node).backgroundColor);
    const channels = productBg.match(/[\d.]+/g)?.map(Number) ?? [];
    expect(channels.length).toBeGreaterThanOrEqual(3);
    expect(channels[0]).toBeGreaterThanOrEqual(245);
    expect(channels[1]).toBeGreaterThanOrEqual(245);
    expect(channels[2]).toBeGreaterThanOrEqual(245);
    await expect(track).toHaveCSS("background-color", "rgb(255, 255, 255)");

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
