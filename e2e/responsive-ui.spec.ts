import { test, expect, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport + 1);
}

const scheduleViewports = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
] as const;

test.describe("responsive UI safeguards", () => {
  for (const viewport of scheduleViewports) {
    test("schedule stays aligned at " + viewport.width + "px", async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/schedule?lang=en");
      for (const id of ["schedule-tab-today", "schedule-tab-list", "schedule-tab-cal"]) {
        await expect(page.locator("#" + id)).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);

      if (viewport.width < 640) {
        await expect(page.locator(".mobile-app-header")).toBeVisible();
        await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
        await expect(page.locator(".tablet-app-nav")).toBeHidden();
        await expect(page.locator(".itjima-desktop-shell")).toHaveCount(0);
      } else if (viewport.width < 1024) {
        await expect(page.locator(".mobile-app-header")).toBeHidden();
        await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
        await expect(page.locator(".tablet-app-nav")).toBeVisible();
        await expect(page.locator(".itjima-desktop-shell")).toHaveCount(0);
      } else {
        const shell = page.locator(".itjima-desktop-shell");
        await expect(shell).toBeVisible();
        await expect(page.locator(".itjima-desktop-nav")).toBeVisible();
        await expect(page.locator(".mobile-app-header")).toHaveCount(0);
        await expect(page.locator(".tablet-app-nav")).toHaveCount(0);
        const box = await shell.boundingBox();
        expect(Math.abs((box?.width ?? 0) - viewport.width)).toBeLessThanOrEqual(2);
        expect(Math.abs((box?.height ?? 0) - viewport.height)).toBeLessThanOrEqual(2);
      }
    });
  }

  for (const viewport of [
    { width: 360, height: 780 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ] as const) {
    for (const route of ["/", "/archive", "/auth"] as const) {
      test(route + " has no horizontal overflow at " + viewport.width + "px", async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(route + "?lang=en");
        await expectNoHorizontalOverflow(page);
      });
    }
  }

  test("desktop uses an independent full-browser workspace", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/?lang=en");
    const shell = page.locator(".itjima-desktop-shell");
    const nav = page.locator(".itjima-desktop-nav");
    const chat = page.locator(".home-chat-lane");
    const composer = page.locator("form.composer-hero");
    await expect(shell).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(chat).toBeVisible();
    await expect(composer).toBeVisible();
    const [shellBox, navBox, chatBox, composerBox] = await Promise.all([
      shell.boundingBox(),
      nav.boundingBox(),
      chat.boundingBox(),
      composer.boundingBox(),
    ]);
    expect(shellBox?.width ?? 0).toBeGreaterThanOrEqual(1438);
    expect(navBox?.width ?? 0).toBeGreaterThanOrEqual(180);
    expect(chatBox?.width ?? 0).toBeLessThanOrEqual(840);
    expect(composerBox?.width ?? 0).toBeLessThanOrEqual(840);
    const chatCenter = (chatBox?.x ?? 0) + (chatBox?.width ?? 0) / 2;
    const composerCenter = (composerBox?.x ?? 0) + (composerBox?.width ?? 0) / 2;
    expect(Math.abs(chatCenter - composerCenter)).toBeLessThanOrEqual(3);
  });

  test("tablet uses its own compact toolbar", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/?lang=en");
    await expect(page.locator(".tablet-app-nav")).toBeVisible();
    await expect(page.locator(".mobile-app-header")).toBeHidden();
    await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
    await expect(page.locator(".itjima-desktop-nav")).toBeHidden();
  });

  test("desktop shortcuts navigate and focus Capture", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/schedule?lang=en");
    await page.keyboard.press("Meta+1");
    await expect(page).toHaveURL(/\/$/);
    await page.keyboard.press("Meta+K");
    await expect(page.locator("#capture-input")).toBeFocused();
    await page.keyboard.press("Meta+3");
    await expect(page).toHaveURL(/\/archive$/);
  });

  test("desktop dialog remains inside the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/schedule?lang=en");
    await page.getByRole("tab", { name: /Calendar|달력/ }).click();
    const today = await page.evaluate(() => new Date().getDate());
    await page.locator(`[data-cal-day="${today}"]`).first().click();
    await page.getByRole("button", { name: /Remember for then|그때 남기기/ }).click();
    const root = page.locator(".bottom-sheet-root");
    const panel = page.locator('.bottom-sheet-panel[role="dialog"]');
    await expect(panel).toBeVisible();
    const [rootBox, panelBox] = await Promise.all([
      root.boundingBox(),
      panel.boundingBox(),
    ]);
    expect(rootBox?.width ?? 0).toBeGreaterThanOrEqual(1023);
    expect(panelBox?.width ?? 0).toBeGreaterThan(430);
    expect(panelBox?.width ?? 0).toBeLessThanOrEqual(681);
    expect(panelBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBeLessThanOrEqual(1024);
  });
});
