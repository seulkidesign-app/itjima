import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "mobile web", width: 390, height: 844 },
  { name: "desktop web", width: 1280, height: 800 },
]) {
  test(`${viewport.name} shows installation guidance immediately on landing`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/about");

    await expect(page.getByTestId("pwa-install-nudge")).toBeVisible();
    await expect(page.getByTestId("pwa-install-guide-action")).toBeVisible();
  });

  test(`${viewport.name} shows an inline installation bar immediately on home`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");

    await expect(page.getByTestId("pwa-install-home-bar")).toBeVisible();
    await expect(page.getByTestId("pwa-home-guide-action")).toBeVisible();
  });
}

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test(`${viewport.name} inline install education does not cover capture tools or long-press targets`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");

    const prompt = page.getByTestId("pwa-install-home-bar");
    const tools = page.getByRole("button", { name: "Attachment tools" });
    await expect(prompt).toBeVisible();
    await expect(tools).toBeVisible();

    const [promptBox, toolsBox] = await Promise.all([
      prompt.boundingBox(),
      tools.boundingBox(),
    ]);
    expect(promptBox).not.toBeNull();
    expect(toolsBox).not.toBeNull();

    const overlaps =
      promptBox!.x < toolsBox!.x + toolsBox!.width &&
      promptBox!.x + promptBox!.width > toolsBox!.x &&
      promptBox!.y < toolsBox!.y + toolsBox!.height &&
      promptBox!.y + promptBox!.height > toolsBox!.y;
    expect(overlaps).toBe(false);

    await tools.click();
    await expect(tools).toHaveAttribute("aria-expanded", "true");
  });
}

test("landing Chrome guide explains desktop, Android, and iPhone installation", async ({
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

test("home Chrome guide explains desktop, Android, and iPhone installation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByTestId("pwa-home-guide-action").click();
  await expect(page.getByTestId("pwa-home-install-guide")).toBeVisible();

  await page.getByTestId("pwa-home-guide-desktop-tab").click();
  await expect(page.getByTestId("pwa-home-guide-chrome-desktop")).toBeVisible();

  await page.getByTestId("pwa-home-guide-android-tab").click();
  await expect(page.getByTestId("pwa-home-guide-chrome-android")).toBeVisible();

  await page.getByTestId("pwa-home-guide-ios-tab").click();
  await expect(page.getByTestId("pwa-home-guide-ios")).toBeVisible();
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
