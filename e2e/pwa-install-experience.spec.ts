import { expect, test } from "@playwright/test";

for (const route of ["/about", "/"] as const) {
  for (const viewport of [
    { name: "mobile web", width: 390, height: 844 },
    { name: "desktop web", width: 1280, height: 800 },
  ]) {
    test(`${viewport.name} shows installation guidance immediately on ${route}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route);

      await expect(page.getByTestId("pwa-install-nudge")).toBeVisible();
      await expect(page.getByTestId("pwa-install-guide-action")).toBeVisible();
    });
  }
}

test("Chrome guide explains desktop, Android, and iPhone installation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");

  await page.getByTestId("pwa-install-guide-action").click();
  await expect(page.getByTestId("pwa-install-guide")).toBeVisible();

  await page.getByTestId("pwa-guide-desktop-tab").click();
  await expect(page.getByTestId("pwa-guide-chrome-desktop")).toBeVisible();

  await page.getByTestId("pwa-guide-android-tab").click();
  await expect(page.getByTestId("pwa-guide-chrome-android")).toBeVisible();

  await page.getByTestId("pwa-guide-ios-tab").click();
  await expect(page.getByTestId("pwa-guide-ios")).toBeVisible();
});

test("uses the browser install prompt when Chrome exposes it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/about");

  await page.evaluate(() => {
    const target = window as typeof window & {
      __itjimaInstallPrompted?: boolean;
    };
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: {
        value: async () => {
          target.__itjimaInstallPrompted = true;
        },
      },
      userChoice: {
        value: Promise.resolve({ outcome: "accepted", platform: "web" }),
      },
    });
    window.dispatchEvent(event);
  });

  const action = page.getByTestId("pwa-install-action");
  await expect(action).toBeVisible();
  await action.click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Boolean(
            (window as typeof window & { __itjimaInstallPrompted?: boolean })
              .__itjimaInstallPrompted,
          ),
      ),
    )
    .toBe(true);
  await expect(page.getByTestId("pwa-install-nudge")).toBeHidden();
});
