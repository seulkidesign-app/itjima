import { test, expect, type Page } from "@playwright/test";

const viewports = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
] as const;

async function layoutMetrics(page: Page) {
  return page.evaluate(() => {
    const documentWidth = document.documentElement.clientWidth;
    const scrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );
    const frameEl = document.querySelector<HTMLElement>(".phone-frame");
    const frameRect = frameEl?.getBoundingClientRect();

    return {
      documentWidth,
      scrollWidth,
      frameWidth: frameRect?.width ?? 0,
      frameLeft: frameRect?.left ?? 0,
      frameRight: frameRect?.right ?? 0,
    };
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await layoutMetrics(page);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.documentWidth + 1);
  expect(metrics.frameLeft).toBeGreaterThanOrEqual(-1);
  expect(metrics.frameRight).toBeLessThanOrEqual(metrics.documentWidth + 1);
  return metrics;
}

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

      const metrics = await expectNoHorizontalOverflow(page);
      const tabMetrics = await page.evaluate(() =>
        [
          document.getElementById("schedule-tab-today"),
          document.getElementById("schedule-tab-list"),
          document.getElementById("schedule-tab-cal"),
        ]
          .filter((element): element is HTMLElement => Boolean(element))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height,
            };
          }),
      );

      expect(tabMetrics).toHaveLength(3);
      const widths = tabMetrics.map((tab) => tab.width);
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);

      for (const tab of tabMetrics) {
        expect(tab.height).toBeGreaterThanOrEqual(42);
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

  for (const viewport of [
    { width: 360, height: 780 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ] as const) {
    for (const route of ["/", "/archive", "/auth"] as const) {
      test(`${route} has no horizontal overflow at ${viewport.width}px`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(route);
        await expect(page.locator(".phone-frame")).toBeVisible();
        await expectNoHorizontalOverflow(page);
      });
    }
  }

  test("desktop app uses a sidebar and centered conversation workspace", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");

    const frame = page.locator(".phone-frame");
    const sidebar = page.locator(".app-top-nav");
    const tabs = page.locator(".app-primary-tabs");
    const chat = page.locator(".home-chat-lane");
    const composer = page.locator("form.composer-hero");

    await expect(frame).toBeVisible();
    await expect(sidebar).toBeVisible();
    await expect(tabs).toBeVisible();
    await expect(chat).toBeVisible();
    await expect(composer).toBeVisible();

    const [frameBox, sidebarBox, tabsBox, chatBox, composerBox] =
      await Promise.all([
        frame.boundingBox(),
        sidebar.boundingBox(),
        tabs.boundingBox(),
        chat.boundingBox(),
        composer.boundingBox(),
      ]);

    expect(frameBox?.width ?? 0).toBeLessThanOrEqual(1181);
    expect(frameBox?.width ?? 0).toBeGreaterThan(900);
    expect(sidebarBox?.width ?? 0).toBeGreaterThanOrEqual(200);
    expect(sidebarBox?.width ?? 0).toBeLessThanOrEqual(230);
    expect(tabsBox?.height ?? 0).toBeGreaterThan(tabsBox?.width ?? 0);
    expect(chatBox?.width ?? 0).toBeLessThanOrEqual(621);
    expect(composerBox?.width ?? 0).toBeLessThanOrEqual(621);

    const chatCenter = (chatBox?.x ?? 0) + (chatBox?.width ?? 0) / 2;
    const composerCenter =
      (composerBox?.x ?? 0) + (composerBox?.width ?? 0) / 2;
    expect(Math.abs(chatCenter - composerCenter)).toBeLessThanOrEqual(2);
  });

  test("tablet keeps the compact top navigation", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    const nav = page.locator(".app-top-nav");
    const tabs = page.locator(".app-primary-tabs");
    const [navBox, tabsBox] = await Promise.all([
      nav.boundingBox(),
      tabs.boundingBox(),
    ]);

    expect(navBox?.width ?? 0).toBeGreaterThan(600);
    expect(tabsBox?.width ?? 0).toBeGreaterThan(tabsBox?.height ?? 0);
  });

  test("desktop shortcuts navigate and focus capture", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/schedule");

    await page.keyboard.press("Meta+1");
    await expect(page).toHaveURL(/\/$/);

    await page.keyboard.press("Meta+K");
    await expect(page.locator("#capture-input")).toBeFocused();

    await page.keyboard.press("Meta+3");
    await expect(page).toHaveURL(/\/archive$/);
  });

  test("input modality switches between pointer and keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await page.mouse.click(20, 20);
    await expect(page.locator("html")).toHaveAttribute("data-input-modality", "pointer");

    await page.keyboard.press("Tab");
    await expect(page.locator("html")).toHaveAttribute("data-input-modality", "keyboard");
  });

  test("bottom sheet backdrop covers desktop while panel remains readable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/schedule");
    await page
      .getByRole("button", { name: /할 일 추가|Add task/i })
      .click();

    const root = page.locator(".bottom-sheet-root");
    const backdrop = page.locator(".bottom-sheet-backdrop");
    const panel = page.locator(".bottom-sheet-panel");

    await expect(panel).toBeVisible();

    const boxes = await Promise.all([
      root.boundingBox(),
      backdrop.boundingBox(),
      panel.boundingBox(),
    ]);
    const [rootBox, backdropBox, panelBox] = boxes;

    expect(rootBox?.width ?? 0).toBeGreaterThanOrEqual(1023);
    expect(backdropBox?.width ?? 0).toBeGreaterThanOrEqual(1023);
    expect(panelBox?.width ?? 0).toBeLessThanOrEqual(681);
    expect(panelBox?.width ?? 0).toBeGreaterThan(430);
    expect(panelBox?.left ?? -1).toBeGreaterThanOrEqual(0);
    expect(panelBox?.right ?? 1025).toBeLessThanOrEqual(1024);
  });
});
