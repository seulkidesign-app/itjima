import { expect, test } from "@playwright/test";

test.describe("Landing V2 editorial system", () => {
  test("uses lowercase English Playpen Sans wordmarks with generous hero clearance", async ({ page }) => {
    await page.goto("/?lang=en");

    const navBrand = page.locator(".lv2-brand");
    const brandDot = page.locator(".lv2-brand-dot");
    const masthead = page.locator(".lv2-brand-masthead");

    await expect(navBrand).toBeVisible();
    await expect(brandDot).toBeVisible();

    const visualBrand = await navBrand.evaluate((node) => {
      const style = getComputedStyle(node, "::after");
      return { content: style.content, family: style.fontFamily, weight: style.fontWeight };
    });
    expect(visualBrand.content).toContain("itjima");
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
    expect(visualMasthead.content).toContain("itjima");
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

  test("glass nav and yellow hero stage stay visually separated without strokes", async ({ page }) => {
    await page.goto("/?lang=ko");

    const nav = page.locator(".lv2-nav");
    const heroStage = page.locator(".lv2-hero-stage");

    const navStyle = await nav.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        borderTopWidth: style.borderTopWidth,
        background: style.backgroundColor,
        backdrop: style.backdropFilter || (style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter || "",
      };
    });
    expect(navStyle.borderTopWidth).toBe("0px");
    expect(navStyle.background).toContain("0.76");
    expect(navStyle.backdrop).toContain("blur(26px)");

    const stageStyle = await heroStage.evaluate((node) => {
      const style = getComputedStyle(node);
      return { backgroundImage: style.backgroundImage, boxShadow: style.boxShadow, borderTopWidth: style.borderTopWidth };
    });
    expect(stageStyle.backgroundImage).toContain("linear-gradient");
    expect(stageStyle.boxShadow).not.toBe("none");
    expect(stageStyle.borderTopWidth).toBe("0px");
  });

  test("trust and information surfaces stay white and avoid nested cards", async ({ page }) => {
    await page.goto("/?lang=ko");

    const trustDemo = page.locator(".lv2-trust-demo");
    const principle = page.locator(".lv2-principles > div").first();
    const workRows = page.locator(".lv2-how .lv2-work-card").first().locator(".lv2-mini-row");

    await trustDemo.scrollIntoViewIfNeeded();
    await expect(trustDemo).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(principle).toHaveCSS("background-color", "rgb(255, 255, 255)");

    await page.locator(".lv2-how").scrollIntoViewIfNeeded();
    expect(await workRows.count()).toBeGreaterThanOrEqual(2);

    const firstRow = await workRows.nth(0).evaluate((node) => {
      const style = getComputedStyle(node);
      return { background: style.backgroundColor, radius: style.borderRadius, shadow: style.boxShadow };
    });
    expect(firstRow.background).toBe("rgba(0, 0, 0, 0)");
    expect(firstRow.radius).toBe("0px");
    expect(firstRow.shadow).toBe("none");

    const secondRowBorder = await workRows.nth(1).evaluate((node) => getComputedStyle(node).borderTopWidth);
    expect(parseFloat(secondRowBorder)).toBeGreaterThan(0);
  });

  test("summary todo tile uses a solid yellow rather than a gradient", async ({ page }) => {
    await page.goto("/?lang=ko");

    const todoTile = page.locator(".lv2-product-card.yellow .lv2-stats > div").nth(1);
    await todoTile.scrollIntoViewIfNeeded();

    const style = await todoTile.evaluate((node) => {
      const computed = getComputedStyle(node);
      return { backgroundColor: computed.backgroundColor, backgroundImage: computed.backgroundImage };
    });
    expect(style.backgroundColor).toBe("rgb(255, 243, 168)");
    expect(style.backgroundImage).toBe("none");
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
