import { test } from "@playwright/test";
import { GUEST_INBOX_KEY } from "./helpers";

async function seed(page: import("@playwright/test").Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto("/");
  await page.evaluate(
    ({ key, item }) => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("itjima.")) localStorage.removeItem(k);
      }
      localStorage.setItem("itjima_lang", "en");
      localStorage.setItem(key, JSON.stringify([item]));
    },
    {
      key: GUEST_INBOX_KEY,
      item: {
        id: "qa2-shot",
        text: "여행",
        images: [],
        created_at: new Date().toISOString(),
        status: "active",
      },
    },
  );
  await page.reload();
  await page.getByRole("link", { name: /^Throw/ }).waitFor({ state: "visible" });
  const close = page.getByRole("button", { name: "Close" });
  if (await close.count()) await close.first().click();
}

test("capture home bubble screenshots without swipe tray", async ({ page }) => {
  for (const width of [390, 430]) {
    await seed(page, width);
    await page.screenshot({
      path: `sprint8-screenshots/qa2-qa3/qa2-${width}-closed.png`,
      fullPage: false,
    });
  }
});
