import { expect, test } from "@playwright/test";

function rgbBrightness(value: string): number {
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
  if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) {
    throw new Error(`Could not read RGB channels from ${value}`);
  }
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("[critical] installed mobile UI stays consistently light when the OS requests dark appearance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/app?lang=en");

  await expect(page.locator("#capture-input")).toBeVisible();

  const colorScheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
  expect(colorScheme).toBe("light");

  // The FINAL 319 empty composer intentionally has a transparent outer
  // wrapper; the visible input pill is the light product surface.
  const surfaces = [
    ["mobile header", ".mobile-app-header"],
    ["capture input pill", "form.composer-hero .input-shell"],
    ["bottom navigation", ".mobile-bottom-nav"],
  ] as const;

  for (const [label, selector] of surfaces) {
    const locator = page.locator(selector).first();
    await expect(locator, `${label} should be visible`).toBeVisible();
    const background = await locator.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(
      rgbBrightness(background),
      `${label} unexpectedly rendered as ${background}`,
    ).toBeGreaterThan(225);
  }

  const inputColor = await page.locator("#capture-input").evaluate(
    (element) => getComputedStyle(element).color,
  );
  expect(
    rgbBrightness(inputColor),
    `capture text needs dark contrast, received ${inputColor}`,
  ).toBeLessThan(80);
});