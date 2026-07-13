import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../sprint8-screenshots");
const BASE = process.env.PREVIEW_URL ?? "http://127.0.0.1:4190";
const VIEW = { width: 390, height: 844 };

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

const ARCHIVE = [
  {
    id: "a1",
    text: "엄마 생일",
    raw_text: "엄마 생일인데 꽃도 사고 케이크도 예약해야지",
    created_at: monthsAgo(3),
    images: [],
    source_id: null,
    brain_mirror: null,
  },
  {
    id: "a2",
    text: "케이크 예약",
    raw_text: "케이크 예약",
    created_at: monthsAgo(3),
    images: [],
    source_id: null,
    brain_mirror: null,
  },
  {
    id: "a3",
    text: "선물 고르기",
    raw_text: "선물 고르기",
    created_at: monthsAgo(2),
    images: [],
    source_id: null,
    brain_mirror: null,
  },
  {
    id: "a4",
    text: "꽃 주문",
    raw_text: "꽃 주문",
    created_at: monthsAgo(2),
    images: [],
    source_id: null,
    brain_mirror: null,
  },
  {
    id: "a5",
    text: "축하 카드",
    raw_text: "축하 카드",
    created_at: monthsAgo(2),
    images: [],
    source_id: null,
    brain_mirror: null,
  },
  {
    id: "a6",
    text: "여행 계획",
    raw_text: "여행 계획",
    created_at: monthsAgo(1),
    images: [],
    source_id: null,
    brain_mirror: null,
  },
  {
    id: "a7",
    text: "숙소",
    raw_text: "숙소",
    created_at: monthsAgo(1),
    images: [],
    source_id: null,
    brain_mirror: null,
  },
  {
    id: "a8",
    text: "항공권",
    raw_text: "항공권",
    created_at: daysAgo(20),
    images: [],
    source_id: null,
    brain_mirror: null,
  },
  {
    id: "a9",
    text: "라면 먹고 싶다",
    raw_text: "라면 먹고 싶다",
    created_at: daysAgo(5),
    images: [],
    source_id: null,
    brain_mirror: null,
  },
  {
    id: "a10",
    text: "카페 가기",
    raw_text: "카페 가기",
    created_at: daysAgo(3),
    images: [],
    source_id: null,
    brain_mirror: null,
  },
  {
    id: "a11",
    text: "노래 듣기",
    raw_text: "노래 듣기",
    created_at: daysAgo(1),
    images: [],
    source_id: null,
    brain_mirror: null,
  },
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `overflow-${i}`,
    text: `엄마 생일 준비 ${i + 1}`,
    raw_text: `엄마 생일 케이크 꽃 선물 준비 ${i + 1}`,
    created_at: monthsAgo(3),
    images: [],
    source_id: null,
    brain_mirror: null,
  })),
];

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function seed(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate((archive) => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("itjima.")) localStorage.removeItem(k);
    }
    localStorage.setItem("itjima_lang", "ko");
    localStorage.setItem("itjima.guest.archive", JSON.stringify(archive));
    localStorage.setItem(
      "itjima.archive.visits",
      JSON.stringify({ a1: 5, a6: 2 }),
    );
  }, ARCHIVE);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEW });
  await seed(page);
  await page.goto(`${BASE}/archive`, { waitUntil: "networkidle" });
  await page.waitForSelector(".archive-space-canvas", { timeout: 15000 });
  await shot(page, "01-overview-clusters-singles");

  await page.locator(".archive-space-node-anchor").first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  await shot(page, "02-detail-sheet");

  await page.getByRole("button", { name: "닫기" }).first().click();
  await page.waitForTimeout(400);
  const overflow = page.locator(".archive-space-overflow").first();
  if (await overflow.count()) {
    await overflow.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
    await shot(page, "03-overflow-n-chip");
  } else {
    console.log("  (no overflow chip in seed — skipped 03)");
  }

  await browser.close();
  console.log(`\nSaved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
