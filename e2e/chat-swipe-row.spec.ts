import { test, expect, type Page, type Locator } from "@playwright/test";
import { GUEST_INBOX_KEY, GUEST_ARCHIVE_KEY, readGuestList } from "./helpers";
import { CHAT_SWIPE_OPEN_DISTANCE } from "../src/components/ChatSwipeRow";

const BTN = 48;
const GAP_BUBBLE = 10;
const BTN_GAP = 8;
const OPEN_DISTANCE = CHAT_SWIPE_OPEN_DISTANCE;

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

async function dragHandle(page: Page, text: string) {
  const ui = await app(page);
  return ui
    .locator(".swipe-row")
    .filter({ hasText: text })
    .locator("[data-chat-swipe-handle]");
}

async function readOffset(handle: Locator) {
  const raw = await handle.getAttribute("data-offset-x");
  return Number(raw ?? "0");
}

async function dragRow(
  page: Page,
  text: string,
  deltaX: number,
  opts?: { release?: boolean; sampleSteps?: number },
) {
  const handle = await dragHandle(page, text);
  await handle.waitFor({ state: "visible" });
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.x + box!.width - 24;
  const y = box!.y + box!.height / 2;
  const steps = opts?.sampleSteps ?? 12;
  const samples: number[] = [];

  await handle.dispatchEvent("pointerdown", {
    button: 0,
    pointerId: 1,
    clientX: startX,
    clientY: y,
    bubbles: true,
  });

  for (let i = 1; i <= steps; i += 1) {
    const x = startX + (deltaX * i) / steps;
    await handle.dispatchEvent("pointermove", {
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
      bubbles: true,
    });
    if (opts?.sampleSteps) samples.push(await readOffset(handle));
  }

  if (opts?.release !== false) {
    await handle.dispatchEvent("pointerup", {
      button: 0,
      pointerId: 1,
      clientX: startX + deltaX,
      clientY: y,
      bubbles: true,
    });
  }

  return samples;
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

async function rowButtons(page: Page, text: string) {
  const ui = await app(page);
  const row = ui.locator(".swipe-row").filter({ hasText: text });
  return {
    schedule: row.getByRole("button", { name: "Send to tasks" }),
    archive: row.getByRole("button", { name: "Save to vault" }),
  };
}

test.describe("QA #2/#3 ChatSwipeRow tray", () => {
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

  test("left drag moves bubble transform continuously", async ({ page }) => {
    await setupRows(page);
    const samples = await dragRow(page, "여행", -OPEN_DISTANCE * 0.6, {
      release: false,
      sampleSteps: 6,
    });
    expect(samples.length).toBeGreaterThan(2);
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]!).toBeLessThanOrEqual(samples[i - 1]! + 0.5);
      expect(samples[i]!).toBeLessThan(-4);
    }
    const handle = await dragHandle(page, "여행");
    await handle.dispatchEvent("pointerup", {
      button: 0,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
    });
  });

  test("open tray shows both actions in viewport with 10px bubble gap", async ({
    page,
  }) => {
    await setupRows(page);
    await dragRow(page, "여행", -OPEN_DISTANCE);
    await page.waitForTimeout(350);

    const { schedule, archive } = await rowButtons(page, "여행");
    await expect(schedule).toBeVisible();
    await expect(archive).toBeVisible();

    const bubble = await bubbleBox(page, "여행");
    const scheduleBox = await schedule.boundingBox();
    const archiveBox = await archive.boundingBox();
    expect(bubble).toBeTruthy();
    expect(scheduleBox).toBeTruthy();
    expect(archiveBox).toBeTruthy();

    const gap = scheduleBox!.x - (bubble!.x + bubble!.width);
    expect(gap).toBeGreaterThanOrEqual(GAP_BUBBLE - 2);
    expect(gap).toBeLessThanOrEqual(GAP_BUBBLE + 2);
    expect(archiveBox!.x - (scheduleBox!.x + scheduleBox!.width)).toBeGreaterThanOrEqual(
      BTN_GAP - 2,
    );
    expect(archiveBox!.x - (scheduleBox!.x + scheduleBox!.width)).toBeLessThanOrEqual(
      BTN_GAP + 2,
    );

    const metrics = await viewportMetrics(page);
    expect(scheduleBox!.x).toBeGreaterThanOrEqual(0);
    expect(archiveBox!.x + archiveBox!.width).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });

  test("reverse drag from open returns transform toward zero", async ({ page }) => {
    await setupRows(page);
    await dragRow(page, "여행", -OPEN_DISTANCE);
    await page.waitForTimeout(350);

    const handle = await dragHandle(page, "여행");
    expect(await readOffset(handle)).toBeLessThan(-OPEN_DISTANCE * 0.9);

    const samples = await dragRow(page, "여행", OPEN_DISTANCE * 0.85, {
      release: false,
      sampleSteps: 6,
    });
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]! - 0.5);
    }

    const box = await handle.boundingBox();
    expect(box).toBeTruthy();
    const startX = box!.x + box!.width - 24;
    const y = box!.y + box!.height / 2;
    await handle.dispatchEvent("pointerup", {
      button: 0,
      pointerId: 1,
      clientX: startX + OPEN_DISTANCE * 0.85,
      clientY: y,
      bubbles: true,
    });
    await page.waitForTimeout(350);
    expect(await readOffset(handle)).toBeGreaterThan(-2);
  });

  test("right swipe while closed does not move bubble or overflow", async ({ page }) => {
    await setupRows(page);
    const handle = await dragHandle(page, "여행");
    const before = await readOffset(handle);
    await dragRow(page, "여행", 80);
    expect(await readOffset(handle)).toBe(before);
    const metrics = await viewportMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });

  test("outside tap, escape, and other row open close the tray", async ({ page }) => {
    const longText =
      "내일 아침에 치과 예약 전화하고, 저녁에는 친구랑 저녁 약속 장소를 다시 확인해야 해.";
    await setupRows(page);
    await dragRow(page, "여행", -OPEN_DISTANCE);
    await page.waitForTimeout(200);
    const { schedule } = await rowButtons(page, "여행");
    await expect(schedule).toBeVisible();

    await page.mouse.click(8, 8);
    await expect(schedule).toHaveCount(0);

    await dragRow(page, "여행", -OPEN_DISTANCE);
    await page.waitForTimeout(200);
    await expect(schedule).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(schedule).toHaveCount(0);

    await dragRow(page, longText, -OPEN_DISTANCE);
    await page.waitForTimeout(200);
    await expect((await rowButtons(page, longText)).schedule).toBeVisible();
    await dragRow(page, "여행", -OPEN_DISTANCE);
    await page.waitForTimeout(200);
    await expect((await rowButtons(page, longText)).schedule).toHaveCount(0);
    await expect((await rowButtons(page, "여행")).schedule).toBeVisible();
  });

  test("action buttons invoke existing schedule and archive handlers", async ({
    page,
  }) => {
    await setupRows(page);
    await dragRow(page, "여행", -OPEN_DISTANCE);
    await page.waitForTimeout(350);

    const { schedule, archive } = await rowButtons(page, "여행");
    await schedule.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: "Close" }).first().click();
    await expect(page.getByText("여행", { exact: true }).first()).toBeVisible();

    await dragRow(page, "여행", -OPEN_DISTANCE);
    await page.waitForTimeout(350);
    await archive.click();
    await expect(
      page.getByRole("paragraph").filter({ hasText: "여행" }),
    ).toHaveCount(0);
    const archiveItems = await readGuestList(page, GUEST_ARCHIVE_KEY);
    expect(archiveItems.length).toBe(1);
    expect((archiveItems[0] as { text: string }).text).toBe("여행");
  });

  test("430px viewport keeps closed and open tray in bounds", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await setupRows(page);

    let metrics = await viewportMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

    await dragRow(page, "여행", -OPEN_DISTANCE);
    await page.waitForTimeout(350);

    const { schedule, archive } = await rowButtons(page, "여행");
    const scheduleBox = await schedule.boundingBox();
    const archiveBox = await archive.boundingBox();
    expect(scheduleBox!.x + scheduleBox!.width).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(archiveBox!.x + archiveBox!.width).toBeLessThanOrEqual(metrics.clientWidth + 1);

    metrics = await viewportMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });
});
