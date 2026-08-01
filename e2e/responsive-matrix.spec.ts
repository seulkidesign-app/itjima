import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "phone-compact", width: 320, height: 568 },
  { name: "phone-android", width: 360, height: 800 },
  { name: "phone-iphone", width: 375, height: 812 },
  { name: "phone-standard", width: 390, height: 844 },
  { name: "phone-large", width: 430, height: 932 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-large", width: 820, height: 1180 },
  { name: "laptop-compact", width: 1024, height: 768 },
  { name: "laptop-standard", width: 1280, height: 800 },
  { name: "laptop-large", width: 1440, height: 900 },
  { name: "desktop-wide", width: 1920, height: 1080 },
] as const;

async function expectInsideViewport(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  expect(box, selector).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(-2);
  expect(box!.y).toBeGreaterThanOrEqual(-2);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 3);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 3);
}

async function expectPcUsesViewport(page: Page) {
  const shell = page.locator(".itjima-desktop-shell");
  const box = await shell.boundingBox();
  const viewport = page.viewportSize();
  const chrome = await shell.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderRadius: Number.parseFloat(style.borderTopLeftRadius) || 0,
      borderWidth: Number.parseFloat(style.borderTopWidth) || 0,
      boxShadow: style.boxShadow,
      position: style.position,
    };
  });

  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(Math.abs(box!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(box!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(box!.width - viewport!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(box!.height - viewport!.height)).toBeLessThanOrEqual(2);
  expect(chrome.borderRadius).toBe(0);
  expect(chrome.borderWidth).toBe(0);
  expect(chrome.boxShadow).toBe("none");
  expect(chrome.position).toBe("fixed");
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
}

async function expectComfortableControls(page: Page) {
  const undersized = await page
    .locator(
      '.phone-frame button:visible, .phone-frame a:visible, .phone-frame [role="button"]:visible, .phone-frame [role="tab"]:visible, .phone-frame [role="menuitem"]:visible',
    )
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label:
              element.getAttribute("aria-label") ||
              element.getAttribute("title") ||
              element.textContent?.trim() ||
              element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter((item) => item.width < 44 || item.height < 44),
    );
  expect(undersized, JSON.stringify(undersized)).toEqual([]);
}

for (const viewport of viewports) {
  test(`[matrix] ${viewport.name} ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/?lang=en");

    await expect(page.locator("#capture-input")).toBeVisible();
    if (viewport.width < 1024) {
      await expectInsideViewport(page, ".itjima-responsive-frame");
    } else {
      await expectPcUsesViewport(page);
    }
    await expectInsideViewport(page, "form.composer-hero");
    await expectNoHorizontalOverflow(page);
    await expectComfortableControls(page);

    if (viewport.width < 640) {
      await expect(page.locator(".mobile-app-header")).toBeVisible();
      await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
      await expect(page.locator(".tablet-app-nav")).toBeHidden();
      await expect(page.locator(".itjima-desktop-nav")).toBeHidden();
      await expect(page.locator(".itjima-desktop-shell")).toHaveCount(0);
    } else if (viewport.width < 1024) {
      await expect(page.locator(".mobile-app-header")).toBeHidden();
      await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
      await expect(page.locator(".tablet-app-nav")).toBeVisible();
      await expect(page.locator(".itjima-desktop-nav")).toBeHidden();
      await expect(page.locator(".itjima-desktop-shell")).toHaveCount(0);
    } else {
      await expect(page.locator(".mobile-app-header")).toHaveCount(0);
      await expect(page.locator(".mobile-bottom-nav")).toHaveCount(0);
      await expect(page.locator(".tablet-app-nav")).toHaveCount(0);
      await expect(page.locator(".itjima-desktop-nav")).toBeVisible();
      await expect(page.locator(".itjima-responsive-frame")).toHaveCount(0);
    }

    const settings = page.locator('[data-testid="open-settings"]:visible');
    await expect(settings).toHaveCount(1);
    await settings.click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(450);
    await expectInsideViewport(page, '.bottom-sheet-panel[role="dialog"]');
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page
      .getByRole("link", { name: /^(Tasks & schedule|Schedule)/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "Schedule", exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("link", { name: "Archive", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Archive", exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
