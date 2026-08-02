import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("itjima_pwa_install_dismissed_until");
  });
});

test("landing gives a clear home-screen installation guide", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");

  const nudge = page.getByTestId("pwa-install-nudge");
  await expect(nudge).toBeVisible();
  await page.getByTestId("pwa-install-action").click();
  await expect(page.getByTestId("pwa-install-guide")).toBeVisible();
});

test("uses the browser install prompt when it is available", async ({ page }) => {
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
