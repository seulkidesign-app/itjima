import { expect, test } from "@playwright/test";
import { resetAppState } from "./helpers";

test("desktop capture controls finish at the bottom of the workspace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await resetAppState(page);

  const composer = page.locator(".composer-hero").last();
  await expect(composer).toBeVisible();

  const metrics = await page.evaluate(() => {
    const scroll = document.getElementById("phone-scroll");
    const composerElement = document.querySelector<HTMLElement>(
      ".itjima-desktop-shell[data-route='home'] .composer-hero",
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
    4,
  );
  expect(metrics.composerTop).toBeGreaterThan(520);
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
  expect(metrics.tabsHeight).toBeLessThanOrEqual(68);
});
