import { test, expect, type Page } from "@playwright/test";
import { GUEST_INBOX_KEY, readGuestList } from "./helpers";

type InboxSeed = {
  id: string;
  text: string;
  images: string[];
  created_at: string;
  status: "active";
};

async function resetThrow(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("itjima.")) localStorage.removeItem(k);
    }
    localStorage.setItem("itjima_lang", "en");
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("link", { name: /^Throw/ }).waitFor({ state: "visible" });
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
  await page.getByRole("link", { name: /^Throw/ }).waitFor({ state: "visible" });
  const closeButtons = page.getByRole("button", { name: "Close" });
  if (await closeButtons.count()) {
    await closeButtons.first().click();
  }
}

function app(page: Page) {
  const frame = page.locator(".phone-frame");
  return frame.count().then((n) => (n > 0 ? frame : page));
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

async function dragBubble(page: Page, text: string, deltaX: number) {
  const ui = await app(page);
  const bubble = ui.getByRole("paragraph").filter({ hasText: text }).first();
  const box = await bubble.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, y, { steps: 12 });
  await page.mouse.up();
}

test.describe("Home chat bubbles without swipe tray", () => {
  test.beforeEach(async ({ page }) => {
    await resetThrow(page);
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

  test("horizontal drag does not reveal schedule or archive buttons", async ({
    page,
  }) => {
    await setupRows(page);
    await dragBubble(page, "여행", -180);
    await page.waitForTimeout(250);

    const ui = await app(page);
    await expect(ui.getByRole("button", { name: "Send to tasks" })).toHaveCount(0);
    await expect(
      ui.getByRole("button", { name: "Save to vault", exact: true }),
    ).toHaveCount(0);
  });

  test("430px viewport keeps bubbles in bounds without swipe overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await setupRows(page);

    const metrics = await viewportMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

    await dragBubble(page, "여행", -180);
    await page.waitForTimeout(250);

    const archiveItems = await readGuestList(page, "itjima.guest.archive");
    expect(archiveItems.length).toBe(0);
    expect(await viewportMetrics(page)).toMatchObject({
      scrollWidth: expect.any(Number),
    });
    expect((await viewportMetrics(page)).scrollWidth).toBeLessThanOrEqual(
      metrics.clientWidth + 1,
    );
  });
});
