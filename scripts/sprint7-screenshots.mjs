import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../sprint7-screenshots");
const BASE = process.env.PREVIEW_URL ?? "http://127.0.0.1:4190";
const VIEW = { width: 390, height: 780 };
const TEXT = "엄마 생일인데 꽃도 사고 케이크도 예약해야지";

function hashText(text) {
  const s = text.trim().replace(/\s+/g, " ");
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function timingSeed() {
  const start = new Date();
  start.setDate(start.getDate() + 11);
  start.setHours(10, 0, 0, 0);
  return {
    title: "엄마 생일 준비",
    items: ["꽃 사기", "케이크 예약"],
    suggestedDateText: "",
    suggestedAction: "",
    confidence: 0.72,
    version: 1,
    isCurrent: true,
    suggestedStart: start.toISOString(),
    timingReason: "생일 2일 전, 여유롭게 준비할 수 있는 순간이에요.",
    timingConfidence: "high",
  };
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function resetForCapture(page) {
  const cacheKey = `none::${TEXT}`;
  const hash = hashText(cacheKey);
  const mirror = timingSeed();
  await page.evaluate(
    ({ payload, hash, mirror }) => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("itjima.")) localStorage.removeItem(k);
      }
      sessionStorage.clear();
      localStorage.setItem("itjima.guest.inbox", JSON.stringify([]));
      localStorage.setItem("itjima.guest.schedules", JSON.stringify([]));
      localStorage.setItem("itjima.guest.archive", JSON.stringify([]));
      localStorage.setItem("itjima_lang", "ko");
      localStorage.setItem(
        "itjima.ai.cache",
        JSON.stringify({
          [hash]: {
            hash,
            result: mirror,
            source: "classify",
            at: new Date().toISOString(),
          },
        }),
      );
    },
    { payload: {}, hash, mirror },
  );
}

async function swipeSchedule(page) {
  const card = page.locator(".touch-none.select-none.rounded-\\[32px\\]").last();
  await card.waitFor({ state: "visible", timeout: 12000 });
  const box = await card.boundingBox();
  if (!box) throw new Error("capture card not found");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 28; i++) {
    await page.mouse.move(cx + i * 12, cy);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEW });

const suggestedStart = new Date();
suggestedStart.setDate(suggestedStart.getDate() + 11);
suggestedStart.setHours(10, 0, 0, 0);

await page.route("**/api/brain-mirror", async (route) => {
  if (route.request().method() !== "POST") return route.continue();
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      category: "schedule",
      title: "엄마 생일 준비",
      suggestedDate: "",
      suggestedStart: suggestedStart.toISOString(),
      reason: "생일 2일 전, 여유롭게 준비할 수 있는 순간이에요.",
      confidence: "high",
      items: ["꽃 사기", "케이크 예약"],
    }),
  });
});

console.log("Frame 1 — SUGGESTED");
await page.goto(BASE);
await resetForCapture(page);
await page.reload();
await page.waitForTimeout(500);

const input = page.locator('textarea, input[type="text"]').first();
await input.fill(TEXT);
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
await page.waitForSelector(".capture-shadow-held, .touch-none.select-none", {
  timeout: 12000,
});
await page.waitForTimeout(4000);

await page.evaluate(
  ({ text, mirror }) => {
    const key = `none::${text.trim()}`;
    let h = 5381;
    const s = key.replace(/\s+/g, " ");
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    const hash = (h >>> 0).toString(36);
    const store = JSON.parse(localStorage.getItem("itjima.ai.cache") || "{}");
    store[hash] = {
      hash,
      result: mirror,
      source: "classify",
      at: new Date().toISOString(),
    };
    localStorage.setItem("itjima.ai.cache", JSON.stringify(store));
  },
  { text: TEXT, mirror: timingSeed() },
);

await swipeSchedule(page);
const suggested = page.getByText("이 생각, 이때 다시 떠올릴까요?");
const manual = page.getByText("이 생각은 언제 다시 떠올리면 좋을까요?");
await Promise.race([
  suggested.waitFor({ state: "visible", timeout: 12000 }),
  manual.waitFor({ state: "visible", timeout: 12000 }),
]);
if (await manual.isVisible()) {
  console.warn("  ! Got MANUAL instead of SUGGESTED — saving anyway");
}
await shot(page, "01-suggested");

console.log("Frame 2 — MANUAL");
const rejectBtn = page.getByRole("button", { name: "다시 생각할게요" });
if (await rejectBtn.isVisible()) {
  await rejectBtn.click();
  await page.getByText("↺ 제안으로 돌아가기").waitFor({ state: "visible", timeout: 8000 });
} else {
  await page.getByText("이 생각은 언제 다시 떠올리면 좋을까요?").waitFor({
    state: "visible",
    timeout: 5000,
  });
}
await shot(page, "02-manual");

console.log("Frame 3 — Today tab");
const now = Date.now();
const todayMorning = new Date();
todayMorning.setHours(10, 0, 0, 0);
if (todayMorning.getTime() <= now) {
  todayMorning.setDate(todayMorning.getDate() + 1);
  todayMorning.setHours(10, 0, 0, 0);
}
const flowedEnd = new Date(now - 2 * 86400000);
flowedEnd.setHours(20, 0, 0, 0);
const flowedStart = new Date(flowedEnd.getTime() - 3600000);

await page.evaluate(
  ({ upcoming, flowedStart, flowedEnd }) => {
    localStorage.setItem(
      "itjima.guest.schedules",
      JSON.stringify([
        {
          id: "s-upcoming",
          text: "엄마 생일 준비",
          start_time: upcoming,
          end_time: new Date(new Date(upcoming).getTime() + 3600000).toISOString(),
          alarm: false,
          created_at: new Date().toISOString(),
          status: "active",
        },
        {
          id: "s-flowed",
          text: "저녁에 케이크 예약하기",
          start_time: flowedStart,
          end_time: flowedEnd,
          alarm: false,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          status: "active",
        },
      ]),
    );
  },
  {
    upcoming: todayMorning.toISOString(),
    flowedStart: flowedStart.toISOString(),
    flowedEnd: flowedEnd.toISOString(),
  },
);

await page.goto(`${BASE}/schedule`);
await page.waitForTimeout(800);
await page.getByRole("tab", { name: "오늘" }).click();
await page.getByText("시작 전").waitFor({ state: "visible", timeout: 8000 });
await page.getByText("흘러간 것").waitFor({ state: "visible", timeout: 8000 });
await shot(page, "03-today-tab");

await browser.close();
console.log(`Done → ${OUT}`);
