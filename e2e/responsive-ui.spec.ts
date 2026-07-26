import { test, expect } from "@playwright/test";

const viewports = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
] as const;

test.describe("responsive UI safeguards", () => {
  for (const viewport of viewports) {
    test(`schedule stays aligned at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/schedule");

      const frame = page.locator(".phone-frame");
      await expect(frame).toBeVisible();

      const tabs = [
        page.locator("#schedule-tab-today"),
        page.locator("#schedule-tab-list"),
        page.locator("#schedule-tab-cal"),
      ];

      for (const tab of tabs) {
        await expect(tab).toBeVisible();
      }

      const metrics = await page.evaluate(() => {
        const documentWidth = document.documentElement.clientWidth;
        const scrollWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        );
        const frameEl = document.querySelector<HTMLElement>(".phone-frame");
        const tabEls = [
          document.getElementById("schedule-tab-today"),
          document.getElementById("schedule-tab-list"),
          document.getElementById("schedule-tab-cal"),
        ].filter((element): element is HTMLElement => Boolean(element));

        return {
          documentWidth,
          scrollWidth,
          frameWidth: frameEl?.getBoundingClientRect().width ?? 0,
          tabs: tabEls.map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height,
            };
          }),
        };
      });

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.documentWidth + 1);
      expect(metrics.tabs).toHaveLength(3);

      const widths = metrics.tabs.map((tab) => tab.width);
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);

      for (const tab of metrics.tabs) {
        expect(tab.height).toBeGreaterThanOrEqual(44);
        expect(tab.left).toBeGreaterThanOrEqual(0);
        expect(tab.right).toBeLessThanOrEqual(metrics.documentWidth + 1);
      }

      if (viewport.width >= 768) {
        expect(metrics.frameWidth).toBeGreaterThan(430);
      } else {
        expect(metrics.frameWidth).toBeLessThanOrEqual(430);
      }
    });
  }
});
