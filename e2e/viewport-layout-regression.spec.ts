import { expect, test, type Page } from "@playwright/test";
import { GUEST_ARCHIVE_KEY, resetAppState } from "./helpers";

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const scroll = document.getElementById("phone-scroll");
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      routeClientWidth: scroll?.clientWidth ?? 0,
      routeScrollWidth: scroll?.scrollWidth ?? 0,
    };
  });

  expect(metrics.documentWidth - metrics.viewportWidth).toBeLessThanOrEqual(1);
  expect(metrics.bodyWidth - metrics.viewportWidth).toBeLessThanOrEqual(1);
  if (metrics.routeClientWidth > 0) {
    expect(
      metrics.routeScrollWidth - metrics.routeClientWidth,
    ).toBeLessThanOrEqual(1);
  }
}

async function seedArchive(page: Page) {
  await page.evaluate(
    ({ key }) => {
      const now = new Date().toISOString();
      localStorage.setItem(
        key,
        JSON.stringify([
          {
            id: "00000000-0000-4000-a000-000000000101",
            text: "Layout reference",
            images: [],
            created_at: now,
          },
          {
            id: "00000000-0000-4000-a000-000000000102",
            text: "Another saved thought",
            images: [],
            created_at: new Date(Date.now() - 60_000).toISOString(),
          },
        ]),
      );
    },
    { key: GUEST_ARCHIVE_KEY },
  );
}

test("desktop capture controls finish at the bottom of the workspace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await resetAppState(page);

  const composer = page.locator(
    ".itjima-desktop-shell[data-route='home'] .page-shell > div > div.composer-hero",
  );
  await expect(composer).toBeVisible();

  const metrics = await page.evaluate(() => {
    const scroll = document.getElementById("phone-scroll");
    const composerElement = document.querySelector<HTMLElement>(
      ".itjima-desktop-shell[data-route='home'] .page-shell > div > div.composer-hero",
    );
    if (!scroll || !composerElement) throw new Error("home layout not found");

    const scrollRect = scroll.getBoundingClientRect();
    const composerRect = composerElement.getBoundingClientRect();
    return {
      scrollBottom: scrollRect.bottom,
      composerTop: composerRect.top,
      composerBottom: composerRect.bottom,
    };
  });

  expect(Math.abs(metrics.scrollBottom - metrics.composerBottom)).toBeLessThanOrEqual(
    10,
  );
  expect(metrics.composerTop).toBeGreaterThan(520);
  await expectNoHorizontalOverflow(page);
});

test("mobile schedule keeps only the compact tabs sticky", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAppState(page);
  await page.getByRole("link", { name: /^Schedule/ }).click();
  await expect(
    page.getByRole("heading", { name: "Schedule", exact: true }),
  ).toBeVisible();

  const metrics = await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>(
      ".itjima-app-stage[data-route='schedule'] .sticky:has(#schedule-tab-today)",
    );
    const tabs = wrapper?.children.item(1) as HTMLElement | null;
    if (!wrapper || !tabs) throw new Error("schedule header not found");

    return {
      wrapperDisplay: getComputedStyle(wrapper).display,
      tabsPosition: getComputedStyle(tabs).position,
      tabsHeight: tabs.getBoundingClientRect().height,
    };
  });

  expect(metrics.wrapperDisplay).toBe("contents");
  expect(metrics.tabsPosition).toBe("sticky");
  expect(Math.round(metrics.tabsHeight)).toBeLessThanOrEqual(68);
  await expectNoHorizontalOverflow(page);
});

test("mobile archive scrolls the title and keeps a compact tool region", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAppState(page);
  await seedArchive(page);
  await page.goto("/archive");
  await expect(
    page.getByRole("heading", { name: "Archive", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("archive-category-filters")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>(
      ".itjima-app-stage[data-route='archive'] .page-shell > div > .sticky.top-0",
    );
    const tools = wrapper?.querySelector<HTMLElement>(":scope > .space-y-2");
    if (!wrapper || !tools) throw new Error("archive controls not found");

    return {
      wrapperDisplay: getComputedStyle(wrapper).display,
      toolsPosition: getComputedStyle(tools).position,
      toolsHeight: tools.getBoundingClientRect().height,
    };
  });

  expect(metrics.wrapperDisplay).toBe("contents");
  expect(metrics.toolsPosition).toBe("sticky");
  expect(metrics.toolsHeight).toBeLessThanOrEqual(150);
  await expectNoHorizontalOverflow(page);
});

for (const viewport of [
  { name: "small phone", width: 320, height: 568 },
  { name: "large phone", width: 430, height: 932 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`${viewport.name} keeps primary routes inside the viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await resetAppState(page);
    await seedArchive(page);

    for (const route of ["/", "/schedule", "/archive", "/rediscovery"]) {
      await page.goto(route);
      await page.locator(".phone-frame").waitFor({ state: "visible" });
      await expectNoHorizontalOverflow(page);

      const shellMetrics = await page.evaluate(() => {
        const scroll = document.getElementById("phone-scroll");
        const bottomNav = document.querySelector<HTMLElement>(
          ".mobile-bottom-nav",
        );
        const tabletNav = document.querySelector<HTMLElement>(".tablet-app-nav");
        const desktopNav = document.querySelector<HTMLElement>(
          ".itjima-desktop-nav",
        );
        const bottomVisible = Boolean(
          bottomNav &&
            bottomNav.offsetParent &&
            getComputedStyle(bottomNav).visibility !== "hidden",
        );
        const tabletVisible = Boolean(
          tabletNav &&
            tabletNav.offsetParent &&
            getComputedStyle(tabletNav).visibility !== "hidden",
        );
        const desktopVisible = Boolean(
          desktopNav &&
            desktopNav.offsetParent &&
            getComputedStyle(desktopNav).visibility !== "hidden",
        );
        const bottomRect = bottomVisible
          ? bottomNav?.getBoundingClientRect()
          : undefined;
        return {
          scrollOwners: document.querySelectorAll("#phone-scroll").length,
          bottomNavVisible: bottomVisible,
          tabletNavVisible: tabletVisible,
          desktopNavVisible: desktopVisible,
          bottomNavLeft: bottomRect?.left ?? 0,
          bottomNavRight: bottomRect?.right ?? 0,
          bottomNavBottom: bottomRect?.bottom ?? 0,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollClientHeight: scroll?.clientHeight ?? 0,
        };
      });

      expect(shellMetrics.scrollOwners).toBe(1);
      expect(shellMetrics.scrollClientHeight).toBeGreaterThan(0);

      if (viewport.width < 640) {
        expect(shellMetrics.bottomNavVisible).toBe(true);
        expect(shellMetrics.tabletNavVisible).toBe(false);
        expect(shellMetrics.desktopNavVisible).toBe(false);
        expect(shellMetrics.bottomNavLeft).toBeGreaterThanOrEqual(4);
        expect(shellMetrics.bottomNavRight).toBeLessThanOrEqual(
          shellMetrics.viewportWidth - 4,
        );
        expect(shellMetrics.bottomNavBottom).toBeLessThanOrEqual(
          shellMetrics.viewportHeight,
        );
      } else if (viewport.width < 1024) {
        expect(shellMetrics.bottomNavVisible).toBe(false);
        expect(shellMetrics.tabletNavVisible).toBe(true);
        expect(shellMetrics.desktopNavVisible).toBe(false);
      } else {
        expect(shellMetrics.bottomNavVisible).toBe(false);
        expect(shellMetrics.tabletNavVisible).toBe(false);
        expect(shellMetrics.desktopNavVisible).toBe(true);
      }
    }
  });
}
