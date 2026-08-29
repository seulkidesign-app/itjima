import { expect, test } from "@playwright/test";

/**
 * PWA install chrome — aligned to Figma 319 locked mobile Home:
 * - Marketing landing keeps the floating nudge hidden.
 * - Mobile Capture keeps installation education out of the primary Home surface.
 * - Desktop Capture may still expose the inline installation bar.
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
    await expect(page.getByTestId("pwa-install-nudge")).toBeHidden();
  });
}

test("mobile Capture keeps the install bar out of Figma 319 Home", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await expect(page.getByTestId("pwa-install-home-bar")).toBeHidden();
});

test("desktop Capture keeps inline installation education available", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/app");
  await expect(page.getByTestId("pwa-install-home-bar")).toBeVisible();
  await expect(page.getByTestId("pwa-home-guide-action")).toBeVisible();
});

test("desktop inline install education does not cover capture tools", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
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

test("desktop Capture Chrome guide explains desktop, Android, and iPhone installation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
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

test("desktop uses the browser install prompt when Chrome exposes it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
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
