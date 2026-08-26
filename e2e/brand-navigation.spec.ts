import { expect, test } from "@playwright/test";

async function useEnglish(page: import("@playwright/test").Page) {
  await page.goto("/app");
  await page.evaluate(() => {
    localStorage.setItem("itjima_lang", "en");
  });
  await page.reload();
}

for (const viewport of [
  { name: "touch", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`${viewport.name} brand opens the landing page while Capture remains app home`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await useEnglish(page);

    await page.goto("/schedule");
    const brand = page.getByRole("link", {
      name: "Open Itjima introduction",
    });
    await expect(brand).toBeVisible();
    await brand.click();
    // Brand links to marketing landing at `/` (/about redirects there).
    await expect(page).toHaveURL(/\/$/);

    const openApp = page
      .getByRole("banner")
      .getByRole("link", { name: /Open app|앱 열기/i })
      .first();
    await expect(openApp).toBeVisible();
    await openApp.click();
    await expect(page).toHaveURL(/\/app\/?$/);

    await page.getByRole("link", {
      name: "Schedule",
      exact: true,
    }).click();
    await expect(page).toHaveURL(/\/schedule$/);

    await page.getByRole("link", { name: "Capture", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/?$/);
  });
}
