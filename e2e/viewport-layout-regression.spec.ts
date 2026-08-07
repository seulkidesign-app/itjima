import { expect, test } from "@playwright/test";
import { resetAppState } from "./helpers";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const metrics = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1);
}

test("desktop capture controls finish at the bottom of the workspace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await resetAppState(page);

  const metrics = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".itjima-desktop-shell");
    const content = document.querySelector<HTMLElement>(".itjima-app-content");
    const composer = document.querySelector<HTMLElement>(".composer-hero");
    if (!shell || !content || !composer) throw new Error("capture layout not found");

    const shellRect = shell.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();

    return {
      shellHeight: shellRect.height,
      contentHeight: contentRect.height,
      composerBottom: composerRect.bottom,
      contentBottom: contentRect.bottom,
      composerTop: composerRect.top,
    };
  });

  expect(metrics.shellHeight).toBeGreaterThanOrEqual(899);
  expect(metrics.contentHeight).toBeGreaterThanOrEqual(899);
  expect(Math.abs(metrics.composerBottom - metrics.contentBottom)).toBeLessThanOrEqual(
    1,
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
  await page.getByRole("link", { name: /^Archive/ }).click();
  await expect(
    page.getByRole("heading", { name: "Archive", exact: true }),
  ).toBeVisible();

  const metrics = await page.evaluate(() => {
    const scroll = document.getElementById("phone-scroll");
    const heading = document.querySelector<HTMLElement>("h1");
    const controls = document.querySelector<HTMLElement>(
      "[data-testid='archive-controls']",
    );
    if (!scroll || !heading || !controls) throw new Error("archive layout not found");

    const before = heading.getBoundingClientRect().top;
    scroll.scrollTop = 240;
    const after = heading.getBoundingClientRect().top;
    const controlsRect = controls.getBoundingClientRect();

    return {
      before,
      after,
      controlsHeight: controlsRect.height,
      controlsPosition: getComputedStyle(controls).position,
    };
  });

  expect(metrics.after).toBeLessThan(metrics.before);
  expect(metrics.controlsHeight).toBeLessThanOrEqual(120);
  expect(["sticky", "static", "relative"]).toContain(metrics.controlsPosition);
  await expectNoHorizontalOverflow(page);
});

for (const viewport of [
  { label: "small phone", width: 320, height: 568 },
  { label: "large phone", width: 430, height: 932 },
  { label: "tablet", width: 820, height: 1180 },
  { label: "desktop", width: 1440, height: 900 },
]) {
  test(`${viewport.label} keeps primary routes inside the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await resetAppState(page);

    for (const route of ["/", "/schedule", "/archive"]) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page);
    }
  });
}
