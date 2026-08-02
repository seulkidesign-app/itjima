import { expect, test } from "@playwright/test";

test("desktop landing scrolls while the desktop app shell remains fixed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");

  const landingMetrics = await page.evaluate(() => {
    const root = document.getElementById("root");
    return {
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      rootOverflowY: root ? getComputedStyle(root).overflowY : "missing",
    };
  });

  expect(landingMetrics.scrollHeight).toBeGreaterThan(
    landingMetrics.viewportHeight,
  );
  expect(landingMetrics.htmlOverflowY).not.toBe("hidden");
  expect(landingMetrics.bodyOverflowY).not.toBe("hidden");
  expect(landingMetrics.rootOverflowY).not.toBe("hidden");

  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

  await page.goto("/schedule");
  const appOverflow = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflowY,
    body: getComputedStyle(document.body).overflowY,
  }));
  expect(appOverflow.html).toBe("hidden");
  expect(appOverflow.body).toBe("hidden");
});
