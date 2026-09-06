import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";
const outDir = path.resolve("portfolio-screenshots");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function freshPage() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(baseURL + "/app", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("itjima_lang", "ko");
    localStorage.setItem("itjima.swipe.tutorial.done", "1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".phone-frame").waitFor({ state: "visible" });
  await page.waitForTimeout(350);
  return { page, context };
}

async function phoneShot(page, file) {
  const frame = page.locator(".phone-frame");
  await frame.screenshot({
    path: path.join(outDir, file),
    animations: "disabled",
  });
}

async function submit(page, text) {
  const frame = page.locator(".phone-frame");
  const input = frame.locator("textarea").first();
  await input.fill(text);
  const button = frame.getByRole("button", { name: /^(남기기|던지기)$/ });
  await button.click();
  await page.waitForTimeout(650);
}

try {
  // 01 Cover: actual ambiguous schedule interpretation state
  {
    const { page, context } = await freshPage();
    await submit(page, "내일 3시 치과");
    await phoneShot(page, "01-cover-ambiguous-schedule.png");
    await context.close();
  }

  // 02 Overview A: capture state with contextual text before submission
  {
    const { page, context } = await freshPage();
    const frame = page.locator(".phone-frame");
    await frame.locator("textarea").first().fill("금요일 오후 7시 민지 만나기");
    await page.waitForTimeout(250);
    await phoneShot(page, "02-overview-capture.png");
    await context.close();
  }

  // 02 Overview B: exact schedule handled by real product
  {
    const { page, context } = await freshPage();
    await submit(page, "내일 오후 3시 치과");
    await phoneShot(page, "03-overview-schedule-result.png");
    await context.close();
  }

  // 02 / 09 Overview C: multiple real contextual records in the actual chat home
  {
    const { page, context } = await freshPage();
    await submit(page, "치과 예약금 보내기");
    await submit(page, "엄마 생신 선물 보기");
    await submit(page, "금요일 오후 7시 민지 만나기");
    await phoneShot(page, "04-contextual-home.png");
    await context.close();
  }

  // 09 V02: rough temporal phrase requiring clarification, actual current behavior
  {
    const { page, context } = await freshPage();
    await submit(page, "주말에 수진이 만나기");
    await phoneShot(page, "05-v02-clarification.png");
    await context.close();
  }

  // 02 / Next: actual Rediscovery experiment screen with a contextual old note
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(baseURL + "/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("itjima_lang", "ko");
      localStorage.setItem(
        "itjima.__feature_overrides__",
        JSON.stringify({ REDISCOVERY: true }),
      );
      localStorage.setItem(
        "itjima.guest.inbox",
        JSON.stringify([
          {
            id: "portfolio-rediscovery-1",
            text: "엄마 생신 선물 후보 다시 찾아보기",
            raw_text: "엄마 생신 선물 후보 다시 찾아보기",
            images: [],
            status: "active",
            temporal_state: "no_time",
            created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
          },
        ]),
      );
      localStorage.setItem("itjima.guest.archive", JSON.stringify([]));
      localStorage.setItem("itjima.guest.schedules", JSON.stringify([]));
    });
    await page.goto(baseURL + "/rediscovery", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const frame = page.locator(".phone-frame");
    if (await frame.count()) {
      await frame.screenshot({
        path: path.join(outDir, "06-overview-rediscovery.png"),
        animations: "disabled",
      });
    } else {
      await page.screenshot({
        path: path.join(outDir, "06-overview-rediscovery.png"),
        animations: "disabled",
        fullPage: false,
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
