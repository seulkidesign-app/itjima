import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "mobile-width trackpad", width: 390, height: 844 },
  { name: "desktop trackpad", width: 1440, height: 900 },
]) {
  test(`${viewport.name} scrolls the landing while app routes keep their own scroll shell`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/about");

    const landingMetrics = await page.evaluate(() => {
      const root = document.getElementById("root");
      const landing = document.querySelector<HTMLElement>(".itjima-launch-page");
      return {
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
        bodyOverflowY: getComputedStyle(document.body).overflowY,
        rootOverflowY: root ? getComputedStyle(root).overflowY : "missing",
        landingTouchAction: landing
          ? getComputedStyle(landing).touchAction
          : "missing",
      };
    });

    expect(landingMetrics.scrollHeight).toBeGreaterThan(
      landingMetrics.viewportHeight,
    );
    expect(landingMetrics.htmlOverflowY).not.toBe("hidden");
    expect(landingMetrics.bodyOverflowY).not.toBe("hidden");
    expect(landingMetrics.rootOverflowY).not.toBe("hidden");
    expect(landingMetrics.landingTouchAction).toContain("pan-y");

    // Playwright's wheel input matches a mouse wheel or trackpad gesture. This
    // catches the narrow-Chrome failure where content overflowed but wheel
    // deltas were not connected to the document scroll owner.
    await page.mouse.move(Math.min(220, viewport.width / 2), 360);
    await page.mouse.wheel(0, 900);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

    await page.goto("/schedule");
    if (viewport.width >= 1024) {
      const appOverflow = await page.evaluate(() => ({
        html: getComputedStyle(document.documentElement).overflowY,
        body: getComputedStyle(document.body).overflowY,
      }));
      expect(appOverflow.html).toBe("hidden");
      expect(appOverflow.body).toBe("hidden");
    } else {
      const appScroll = page.locator("#phone-scroll");
      await expect(appScroll).toBeVisible();
      await expect(appScroll).toHaveCSS("overflow-y", "auto");
    }
  });
}
