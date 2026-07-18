import { test, expect, type Page } from "@playwright/test";
import { GUEST_INBOX_KEY } from "./helpers";

const BTN = 48;
const GAP = 10;
const OPEN_SLOT = BTN + GAP;

type InboxSeed = {
  id: string;
  text: string;
  images: string[];
  created_at: string;
  status: "active";
};

async function resetThoughts(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("itjima.")) localStorage.removeItem(k);
    }
    localStorage.setItem("itjima_lang", "en");
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("link", { name: /^Thoughts/ }).waitFor({ state: "visible" });
  const closeButtons = page.getByRole("button", { name: "Close" });
  if (await closeButtons.count()) {
    await closeButtons.first().click();
  }
}

async function seedInbox(page: Page, items: InboxSeed[]) {
  await page.evaluate(
    ({ key, rows }) => {
      localStorage.setItem(key, JSON.stringify(rows));
    },
    { key: GUEST_INBOX_KEY, rows: items },
  );
  await page.reload();
  await page.getByRole("link", { name: /^Thoughts/ }).waitFor({ state: "visible" });
  const closeButtons = page.getByRole("button", { name: "Close" });
  if (await closeButtons.count()) {
    await closeButtons.first().click();
  }
}

function app(page: Page) {
  const frame = page.locator(".phone-frame");
  return frame.count().then((n) => (n > 0 ? frame : page));
}

async function rowForText(page: Page, text: string) {
  const ui = await app(page);
  return ui.locator(".swipe-row").filter({ hasText: text });
}

async function dragHandle(page: Page, text: string) {
  const ui = await app(page);
  return ui
    .locator(".swipe-row")
    .filter({ hasText: text })
    .locator("[data-chat-swipe-handle]");
}

async function dragRow(page: Page, text: string, deltaX: number) {
  const handle = await dragHandle(page, text);
  await handle.waitFor({ state: "visible" });
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.x + box!.width - 24;
  const y = box!.y + box!.height / 2;
  await handle.dispatchEvent("pointerdown", {
    button: 0,
    pointerId: 1,
    clientX: startX,
    clientY: y,
    bubbles: true,
  });
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    const x = startX + (deltaX * i) / steps;
    await handle.dispatchEvent("pointermove", {
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
      bubbles: true,
    });
  }
  await handle.dispatchEvent("pointerup", {
    button: 0,
    pointerId: 1,
    clientX: startX + deltaX,
    clientY: y,
    bubbles: true,
  });
}

async function viewportMetrics(page: Page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
}

async function bubbleBox(page: Page, text: string) {
  const ui = await app(page);
  return ui
    .getByText(text, { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'chat-bubble')]")
    .first()
    .boundingBox();
}

async function archiveButton(page: Page, text: string) {
  const row = await rowForText(page, text);
  return row.getByRole("button", { name: "Save to thought map" });
}

test.describe("QA #2/#3 ChatSwipeRow", () => {
  test.beforeEach(async ({ page }) => {
    await resetThoughts(page);
  });

  async function setupRows(page: Page) {
    const now = Date.now();
    await seedInbox(page, [
      {
        id: `qa2-short-${now}`,
        text: "여행",
        images: [],
        created_at: new Date(now - 1000).toISOString(),
        status: "active",
      },
      {
        id: `qa2-long-${now}`,
        text:
          "내일 아침에 치과 예약 전화하고, 저녁에는 친구랑 저녁 약속 장소를 다시 확인해야 해.",
        images: [],
        created_at: new Date(now).toISOString(),
        status: "active",
      },
    ]);
  }

  test("closed state keeps bubbles inside viewport without horizontal scroll", async ({
    page,
  }) => {
    await setupRows(page);
    const metrics = await viewportMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

    for (const text of [
      "여행",
      "내일 아침에 치과 예약 전화하고, 저녁에는 친구랑 저녁 약속 장소를 다시 확인해야 해.",
    ]) {
      const bubble = await bubbleBox(page, text);
      expect(bubble).toBeTruthy();
      expect(bubble!.x).toBeGreaterThanOrEqual(0);
      expect(bubble!.x + bubble!.width).toBeLessThanOrEqual(metrics.clientWidth + 1);
    }
  });

  test("left swipe reveals archive action fully with ~10px gap", async ({ page }) => {
    await setupRows(page);
    await dragRow(page, "여행", -OPEN_SLOT);
    await page.waitForTimeout(350);

    const btn = await archiveButton(page, "여행");
    await expect(btn).toBeVisible();

    const bubble = await bubbleBox(page, "여행");
    const button = await btn.boundingBox();
    expect(bubble).toBeTruthy();
    expect(button).toBeTruthy();

    const gap = button!.x - (bubble!.x + bubble!.width);
    expect(gap).toBeGreaterThanOrEqual(GAP - 2);
    expect(gap).toBeLessThanOrEqual(GAP + 2);

    const metrics = await viewportMetrics(page);
    expect(button!.x).toBeGreaterThanOrEqual(0);
    expect(button!.x + button!.width).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });

  test("reverse swipe and outside click close the row", async ({ page }) => {
    await setupRows(page);
    await dragRow(page, "여행", -OPEN_SLOT);
    const opened = await archiveButton(page, "여행");
    await expect(opened).toBeVisible();

    await dragRow(page, "여행", OPEN_SLOT);
    await expect(opened).toHaveCount(0);

    await dragRow(page, "여행", -OPEN_SLOT);
    await expect(opened).toBeVisible();
    await page.mouse.click(8, 8);
    await expect(opened).toHaveCount(0);
  });

  test("opening one row closes another", async ({ page }) => {
    const longText =
      "내일 아침에 치과 예약 전화하고, 저녁에는 친구랑 저녁 약속 장소를 다시 확인해야 해.";
    await setupRows(page);
    await dragRow(page, longText, -OPEN_SLOT);
    const longBtn = await archiveButton(page, longText);
    await expect(longBtn).toBeVisible();

    await dragRow(page, "여행", -OPEN_SLOT);
    await expect(await archiveButton(page, "여행")).toBeVisible();
    await expect(longBtn).toHaveCount(0);
  });

  test("430px viewport keeps closed and open states in bounds", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await setupRows(page);

    let metrics = await viewportMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

    await dragRow(page, "여행", -OPEN_SLOT);
    const bubble = await bubbleBox(page, "여행");
    const button = await (await archiveButton(page, "여행")).boundingBox();
    expect(bubble).toBeTruthy();
    expect(button).toBeTruthy();
    expect(button!.x + button!.width).toBeLessThanOrEqual(metrics.clientWidth + 1);

    metrics = await viewportMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });
});
