import { expect, test } from "@playwright/test";

test.describe("locked landing brand visual contract", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile app chrome uses the lowercase canonical logo and 20/56 baseline", async ({
    page,
  }) => {
    await page.goto("/app");

    const header = page.locator(".mobile-app-header-bar");
    const logo = page.locator(
      '.mobile-app-header-bar [data-testid="brand-logo"]',
    );
    const search = page.getByTestId("open-browse-search");
    const settings = page.getByTestId("open-settings").first();

    await expect(header).toBeVisible();
    await expect(logo).toBeVisible();
    await expect(logo).toContainText("itjima");

    const [headerBox, logoBox, searchBox, settingsBox] = await Promise.all([
      header.boundingBox(),
      logo.boundingBox(),
      search.boundingBox(),
      settings.boundingBox(),
    ]);

    expect(headerBox).not.toBeNull();
    expect(logoBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(settingsBox).not.toBeNull();

    expect(headerBox!.height).toBeCloseTo(56, 0);
    expect(logoBox!.width).toBeCloseTo(71.273, 0);
    expect(logoBox!.height).toBeCloseTo(24, 0);
    expect(logoBox!.x - headerBox!.x).toBeCloseTo(20, 0);
    expect(searchBox!.width).toBeCloseTo(44, 0);
    expect(searchBox!.height).toBeCloseTo(44, 0);
    expect(settingsBox!.width).toBeCloseTo(44, 0);
    expect(settingsBox!.height).toBeCloseTo(44, 0);

    await expect(logo).toHaveAttribute("data-brand-source", "figma-455-33");
  });

  test("landing header renders the lowercase 455:33 brand treatment", async ({ page }) => {
    await page.goto("/");

    const v2Brand = page.locator(".lv2-brand");
    if (await v2Brand.isVisible().catch(() => false)) {
      const metrics = await v2Brand.evaluate((element) => {
        const dotElement = element.querySelector(".lv2-brand-dot")!;
        const dot = getComputedStyle(dotElement);
        const word = getComputedStyle(element, "::after");
        return {
          dotWidth: dot.width,
          dotHeight: dot.height,
          dotColor: dot.backgroundColor,
          gap: getComputedStyle(element).gap,
          content: word.content,
          fontFamily: word.fontFamily,
          fontSize: word.fontSize,
          fontWeight: word.fontWeight,
          letterSpacing: word.letterSpacing,
          color: word.color,
          textTransform: word.textTransform,
        };
      });

      expect(metrics.dotWidth).toBe("14px");
      expect(metrics.dotHeight).toBe("14px");
      expect(metrics.dotColor).toBe("rgb(255, 230, 88)");
      expect(metrics.gap).toBe("10px");
      expect(metrics.content.replace(/[\"']/g, "")).toBe("itjima");
      expect(metrics.fontFamily).toContain("Playpen Sans");
      expect(metrics.fontSize).toBe("21.582px");
      expect(metrics.fontWeight).toBe("400");
      expect(parseFloat(metrics.letterSpacing)).toBeCloseTo(0.1434, 2);
      expect(metrics.color).toBe("rgb(46, 46, 46)");
      expect(metrics.textTransform).toBe("none");
      return;
    }

    const wordmark = page.locator(".landing-motion-wordmark");
    const word = wordmark.locator(":scope > span:first-child");
    await expect(wordmark).toBeVisible();

    const metrics = await wordmark.evaluate((element) => {
      const dot = getComputedStyle(element, "::before");
      const text = getComputedStyle(element.querySelector("span")!);
      return {
        dotWidth: dot.width,
        dotHeight: dot.height,
        dotColor: dot.backgroundColor,
        gap: getComputedStyle(element).gap,
        fontFamily: text.fontFamily,
        fontSize: text.fontSize,
        fontWeight: text.fontWeight,
        letterSpacing: text.letterSpacing,
        color: text.color,
        textTransform: text.textTransform,
      };
    });

    expect(metrics.dotWidth).toBe("14px");
    expect(metrics.dotHeight).toBe("14px");
    expect(metrics.dotColor).toBe("rgb(255, 230, 88)");
    expect(metrics.gap).toBe("10px");
    expect(metrics.fontFamily).toContain("Playpen Sans");
    expect(metrics.fontSize).toBe("21.582px");
    expect(metrics.fontWeight).toBe("400");
    expect(parseFloat(metrics.letterSpacing)).toBeCloseTo(0.1434, 2);
    expect(metrics.color).toBe("rgb(46, 46, 46)");
    expect(metrics.textTransform).toBe("lowercase");
    await expect(word).toHaveText(/itjima/i);
  });
});
