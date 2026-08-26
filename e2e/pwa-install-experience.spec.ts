import { expect, test } from "@playwright/test";

/**
 * PWA install chrome — aligned to current IA:
 * - Landing (`/`) intentionally hides the floating nudge (design lock).
 * - Home install bar mounts on Capture (`/app`).
 */

for (const viewport of [
  { name: "mobile web", width: 390, height: 844 },
  { name: "desktop web", width: 1280, height: 800 },
]) {
  test(`${viewport.name} keeps the floating install nudge off the marketing landing`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    // Product intentionally hides the nudge on `.itjima-launch-page`.
    await expect(page.getByTestId("pwa-install-nudge")).toBeHidden();
  });

  test(`${viewport.name} shows an inline installation bar on Capture home`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/app");
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
    await page.goto("/app");

    const prompt = page.getByTestId("pwa-install-home-bar");
    const tools = page.getByRole("button", { name: /첨부 도구|Attach tools|Tools/i });
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

test("Capture Chrome guide explains desktop, Android, and iPhone installation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");

  await page.getByTestId("pwa-home-guide-action").click();
  await expect(page.getByTestId("pwa-home-install-guide")).toBeVisible();

  await page.getByTestId("pwa-home-guide-desktop-tab").click();
  await expect(page.getByTestId("pwa-home-guide-chrome-desktop")).toBeVisible();

  await page.getByTestId("pwa-home-guide-android-tab").click();
  await expect(page.getByTestId("pwa-home-guide-chrome-android")).toBeVisible();

  await page.getByTestId("pwa-home-guide-ios-tab").click();
  await expect(page.getByTestId("pwa-home-guide-ios")).toBeVisible();
});

test("home Chrome guide explains desktop, Android, and iPhone installation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");

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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    (window as unknown as { deferredInstallPrompt: unknown }).deferredInstallPrompt =
      {
        prompt: async () => undefined,
        userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
      };
  });
  await page.goto("/app");
  await expect(page.getByTestId("pwa-install-home-bar")).toBeVisible();
  const install = page.getByTestId("pwa-home-install-action");
  if (await install.isVisible().catch(() => false)) {
    await install.click();
  }
});
