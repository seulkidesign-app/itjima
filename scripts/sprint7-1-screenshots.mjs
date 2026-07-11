import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../sprint7-1-screenshots");
const BASE = process.env.PREVIEW_URL ?? "http://127.0.0.1:4190";
const VIEW = { width: 390, height: 780 };
const BIRTHDAY = "엄마 생일인데 꽃도 사고 케이크도 예약해야지";
const NO_REASON = "홍대 분위기 좋았던 카페, 창가 자리";

function hashText(text) {
  const s = text.trim().replace(/\s+/g, " ");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

async function shot(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: false,
  });
  console.log(`  ✓ ${name}.png`);
}

async function reset(page) {
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("itjima.")) localStorage.removeItem(k);
    }
    sessionStorage.clear();
    localStorage.setItem("itjima.guest.inbox", "[]");
    localStorage.setItem("itjima.guest.schedules", "[]");
    localStorage.setItem("itjima.guest.archive", "[]");
    localStorage.setItem("itjima_lang", "ko");
  });
}

async function seedReasonCache(page, text, reason) {
  const key = `none::${text.trim()}`;
  const hash = hashText(key);
  await page.evaluate(
    ({ hash, reason, title }) => {
      localStorage.setItem(
        "itjima.ai.cache",
        JSON.stringify({
          [hash]: {
            hash,
            result: {
              title,
              items: ["항목"],
              suggestedDateText: "",
              suggestedAction: "",
              confidence: 0.72,
              version: 1,
              isCurrent: true,
              timingReason: reason,
              timingConfidence: "high",
            },
            source: "classify",
            at: new Date().toISOString(),
          },
        }),
      );
    },
    { hash, reason, title: "테스트" },
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

async function openWhenSheet(page, text, reason) {
  await page.goto(BASE);
  await reset(page);
  await page.reload();
  await page.waitForTimeout(500);
  const input = page.locator('textarea, input[type="text"]').first();
  await input.fill(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3500);
  if (reason) await seedReasonCache(page, text, reason);
  await swipeSchedule(page);
  await page
    .getByText("이 생각은 언제 다시 떠올리면 좋을까요?")
    .waitFor({ state: "visible", timeout: 10000 });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEW });
await page.goto(BASE);
await page.waitForTimeout(300);

console.log("① Banner present");
await openWhenSheet(
  page,
  BIRTHDAY,
  "여유롭게 준비할 수 있을 때가 좋을 것 같아요.",
);
await shot(page, "01-banner-present");

console.log("② Banner absent");
await openWhenSheet(page, NO_REASON, null);
await shot(page, "02-banner-absent");

console.log("③ Wheel picker mid-drag");
await page.getByRole("button", { name: "날짜 선택" }).click();
const wheel = page.locator(".wheel-col").first();
await wheel.waitFor({ state: "visible" });
const box = await wheel.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.7);
  await page.mouse.down();
  for (let i = 0; i < 18; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.7 - i * 8);
    await page.waitForTimeout(30);
  }
}
await shot(page, "03-wheel-mid-drag");

await browser.close();
console.log(`Done → ${OUT}`);
