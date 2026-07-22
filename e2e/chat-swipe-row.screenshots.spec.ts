import { test } from "@playwright/test";
import { GUEST_INBOX_KEY } from "./helpers";
import { CHAT_SWIPE_OPEN_DISTANCE } from "../src/components/ChatSwipeRow";

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
  await page.getByRole("link", { name: /^Leave it/ }).waitFor({ state: "visible" });
  const close = page.getByRole("button", { name: "Close" });
  if (await close.count()) await close.first().click();
}

async function dragTo(
  page: import("@playwright/test").Page,
  deltaX: number,
  opts?: { release?: boolean },
) {
  const handle = page.locator("[data-chat-swipe-handle]").first();
  const box = await handle.boundingBox();
  if (!box) return;
  const startX = box.x + box.width - 24;
  const y = box.y + box.height / 2;
  await handle.dispatchEvent("pointerdown", {
    button: 0,
    pointerId: 1,
    clientX: startX,
    clientY: y,
    bubbles: true,
  });
  const steps = 10;
  for (let i = 1; i <= steps; i += 1) {
    await handle.dispatchEvent("pointermove", {
      button: 0,
      pointerId: 1,
      clientX: startX + (deltaX * i) / steps,
      clientY: y,
      bubbles: true,
    });
  }
  if (opts?.release !== false) {
    await handle.dispatchEvent("pointerup", {
      button: 0,
      pointerId: 1,
      clientX: startX + deltaX,
      clientY: y,
      bubbles: true,
    });
    await page.waitForTimeout(350);
  }
}

test("capture QA2/3 tray screenshots", async ({ page }) => {
  for (const width of [390, 430]) {
    await seed(page, width);
    await page.screenshot({
      path: `sprint8-screenshots/qa2-qa3/qa2-${width}-closed.png`,
      fullPage: false,
    });

    await dragTo(page, -CHAT_SWIPE_OPEN_DISTANCE * 0.55, { release: false });
    await page.screenshot({
      path: `sprint8-screenshots/qa2-qa3/qa2-${width}-dragging.png`,
      fullPage: false,
    });
    await page.locator("[data-chat-swipe-handle]").first().dispatchEvent("pointerup", {
      button: 0,
      pointerId: 1,
      bubbles: true,
    });
    await page.waitForTimeout(250);

    await dragTo(page, -CHAT_SWIPE_OPEN_DISTANCE);
    await page.screenshot({
      path: `sprint8-screenshots/qa2-qa3/qa2-${width}-open.png`,
      fullPage: false,
    });
  }
});
