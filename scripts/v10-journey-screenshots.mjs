import { chromium } from "@playwright/test";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../v10-journey-screenshots");
const BASE = process.env.PREVIEW_URL ?? "http://127.0.0.1:4190";
const VIEW = { width: 390, height: 780 };

const now = Date.now();
const day = 86400000;
const todayAt = (h, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

const seed = {
  inbox: [],
  schedules: [
    {
      id: "demo-sched-1",
      text: "엄마 생일 준비",
      start_time: new Date(now + day * 2).toISOString(),
      end_time: new Date(now + day * 2 + 3600000).toISOString(),
      alarm: true,
      created_at: new Date(now - day * 5).toISOString(),
      status: "active",
      source_id: "demo-arch-1",
    },
    {
      id: "demo-sched-2",
      text: "저녁에 케이크 예약하기",
      start_time: new Date(todayAt(19).getTime()).toISOString(),
      end_time: new Date(todayAt(20).getTime()).toISOString(),
      alarm: false,
      created_at: new Date(now - day).toISOString(),
      status: "active",
    },
  ],
  archive: [
    {
      id: "demo-arch-1",
      text: "엄마 생일인데 꽃도 사고 케이크도 예약해야지",
      images: [],
      created_at: new Date(now - day * 21).toISOString(),
    },
    {
      id: "demo-arch-2",
      text: "홍대 분위기 좋았던 카페, 창가 자리",
      images: [],
      created_at: new Date(now - day * 45).toISOString(),
    },
    {
      id: "demo-arch-3",
      text: "독일 유학 비자 준비 어떻게 하지?",
      images: [],
      created_at: new Date(now - day * 12).toISOString(),
    },
  ],
};

const CAPTURE_TEXT = "엄마 생일인데 꽃도 사고 케이크도 예약해야지";

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.waitForTimeout(350);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function resetGuest(page, data = seed) {
  await page.evaluate((payload) => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("itjima.")) localStorage.removeItem(k);
    }
    sessionStorage.clear();
    localStorage.setItem("itjima.guest.inbox", JSON.stringify(payload.inbox));
    localStorage.setItem("itjima.guest.schedules", JSON.stringify(payload.schedules));
    localStorage.setItem("itjima.guest.archive", JSON.stringify(payload.archive));
    localStorage.setItem("itjima_lang", "ko");
  }, data);
}

async function openScheduleFromCapture(page) {
  const card = page.locator(".touch-none.select-none.rounded-\\[32px\\]").last();
  await card.waitFor({ state: "visible", timeout: 8000 });
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
  await page.getByText("이 생각은 언제 다시 떠올리면 좋을까요?").waitFor({
    state: "visible",
    timeout: 8000,
  });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

const page = await browser.newPage({ viewport: VIEW });

await page.goto(BASE);
await resetGuest(page);
await page.reload();
await page.waitForTimeout(600);

console.log("Capture flow…");
await page.goto(`${BASE}/`);
await page.waitForTimeout(500);
await shot(page, "01-capture-idle");

const input = page.locator("#capture-input");
await input.fill(CAPTURE_TEXT);
await shot(page, "02-capture-typing");

await page.getByRole("button", { name: "남기기" }).click();
await page.locator(".capture-shadow-held").waitFor({ state: "visible", timeout: 5000 });
await page.screenshot({ path: path.join(OUT, "03-capture-understand.png"), fullPage: false });
console.log("  ✓ 03-capture-understand.png");

await page
  .locator(".mt-\\[40px\\] p")
  .first()
  .waitFor({ state: "visible", timeout: 6000 });
await shot(page, "04-capture-mirror");

await page.getByText("그때 →").waitFor({ state: "visible", timeout: 6000 });
await shot(page, "05-capture-interactive");

console.log("Schedule flow…");
await openScheduleFromCapture(page);
await shot(page, "06-schedule-suggested");

await page.getByRole("button", { name: "시간 보기" }).click();
await page.getByText("시작").waitFor({ state: "visible", timeout: 5000 });
await page.waitForTimeout(400);
await shot(page, "07-schedule-time-picker");

await page.getByRole("button", { name: "알림 정하기" }).click();
await page.getByText("30분 전").waitFor({ state: "visible", timeout: 5000 });
await shot(page, "08-schedule-reminder");

await page.getByRole("button", { name: "그때 맡겨둘게요" }).click();
await page.getByText("그때 다시 떠올릴게요").waitFor({ state: "visible", timeout: 8000 });
await shot(page, "09-schedule-saved");

console.log("Today / Archive / Rediscovery…");
await resetGuest(page, {
  ...seed,
  inbox: [
    {
      id: "demo-inbox-1",
      text: CAPTURE_TEXT,
      images: [],
      created_at: new Date(now - day).toISOString(),
      status: "active",
    },
  ],
});
await page.goto(`${BASE}/schedule`);
await page.waitForTimeout(900);
await shot(page, "10-today-home");

await page.goto(`${BASE}/archive`);
await page.waitForTimeout(900);
await shot(page, "11-archive-overview");

await page.locator(".archive-memory-space button", { hasText: "독일" }).click();
await page.locator("[role='dialog']").waitFor({ state: "visible", timeout: 5000 });
await shot(page, "12-archive-memory-detail");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await page.goto(`${BASE}/rediscovery`);
await page.waitForTimeout(900);
await shot(page, "13-rediscovery-card");

await page.getByRole("button", { name: "보기" }).click();
await page.waitForURL("**/archive**", { timeout: 8000 });
await page.waitForTimeout(700);
await page.locator(".archive-memory-space button", { hasText: "홍대" }).click();
await page.locator("[role='dialog']").waitFor({ state: "visible", timeout: 5000 });
await shot(page, "14-rediscovery-after-open");

await page.close();

console.log("Recording flow GIF…");
const videoDir = path.join(OUT, "_video");
await mkdir(videoDir, { recursive: true });
const ctx = await browser.newContext({
  viewport: VIEW,
  recordVideo: { dir: videoDir, size: VIEW },
});
const gifPage = await ctx.newPage();
await gifPage.goto(BASE);
await resetGuest(gifPage, { ...seed, inbox: [] });
await gifPage.reload();
await gifPage.waitForTimeout(500);

await gifPage.goto(`${BASE}/`);
await gifPage.waitForTimeout(600);
await gifPage.locator("#capture-input").fill(CAPTURE_TEXT);
await gifPage.getByRole("button", { name: "남기기" }).click();
await gifPage.getByText("그때 →").waitFor({ state: "visible", timeout: 8000 });
await gifPage.waitForTimeout(800);
await openScheduleFromCapture(gifPage);
await gifPage.waitForTimeout(700);
await gifPage.getByRole("button", { name: "시간 보기" }).click();
await gifPage.waitForTimeout(500);
await gifPage.getByRole("button", { name: "알림 정하기" }).click();
await gifPage.waitForTimeout(500);
await gifPage.getByRole("button", { name: "그때 맡겨둘게요" }).click();
await gifPage.waitForTimeout(1200);

await resetGuest(gifPage, seed);
await gifPage.goto(`${BASE}/schedule`);
await gifPage.waitForTimeout(900);
await gifPage.goto(`${BASE}/archive`);
await gifPage.waitForTimeout(900);
await gifPage.goto(`${BASE}/rediscovery`);
await gifPage.waitForTimeout(900);
await gifPage.getByRole("button", { name: "보기" }).click();
await gifPage.waitForTimeout(1200);

const video = gifPage.video();
await gifPage.close();
await ctx.close();
const webmPath = video ? await video.path() : null;
await browser.close();

if (webmPath) {
  const gifOut = path.join(OUT, "00-user-flow.gif");
  const filters =
    "fps=8,scale=390:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5";
  try {
    const ffmpegPath = (await import("ffmpeg-static")).default;
    const r = spawnSync(ffmpegPath, ["-y", "-i", webmPath, "-vf", filters, gifOut], {
      stdio: "pipe",
    });
    if (r.status === 0) console.log("  ✓ 00-user-flow.gif");
    else {
      const { copyFileSync } = await import("node:fs");
      copyFileSync(webmPath, path.join(OUT, "00-user-flow.webm"));
      console.log("  ! gif encode failed — saved 00-user-flow.webm");
    }
  } catch {
    const { copyFileSync } = await import("node:fs");
    copyFileSync(webmPath, path.join(OUT, "00-user-flow.webm"));
    console.log("  ! ffmpeg-static missing — saved 00-user-flow.webm");
  }
  for (const f of await readdir(videoDir)) {
    await unlink(path.join(videoDir, f)).catch(() => {});
  }
}

console.log(`\nDone — ${OUT}`);
