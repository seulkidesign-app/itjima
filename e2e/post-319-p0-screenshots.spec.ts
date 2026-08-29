import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";
import {
  phone,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  readGuestList,
} from "./helpers";

const OUT_DIR = join(process.cwd(), "e2e-screenshots", "post-319-p0");

async function resetKo(page: Page) {
  await page.goto("/app");
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("itjima.")) localStorage.removeItem(k);
    }
    localStorage.setItem("itjima_lang", "ko");
    sessionStorage.clear();
  });
  await page.reload();
  await phone(page)
    .getByRole("link", { name: /^(남기기|Capture)/ })
    .waitFor();
}

async function submit(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame
    .getByRole("button", { name: /^(남기기|던지기)$/, exact: false })
    .click();
  await frame
    .locator(
      '[data-testid="left-item-row"], [data-testid="saved-schedule-feedback"], [data-testid="inline-promise"]',
    )
    .last()
    .waitFor({ state: "visible" });
  await page.waitForTimeout(280);
}

test.describe("POST-319 Manual QA · P0 screenshots", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.setTimeout(90_000);

  test("capture P0 acceptance states", async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true });
    await resetKo(page);

    // 1) Empty Home
    await phone(page).screenshot({
      path: join(OUT_DIR, "01-empty-home.png"),
    });

    // P0-1: search icon opens canonical browse sheet
    await phone(page).getByTestId("open-browse-search").click();
    await expect(phone(page).getByTestId("records-browse-sheet")).toBeVisible();
    await phone(page).screenshot({
      path: join(OUT_DIR, "01b-browse-search.png"),
    });
    await page.keyboard.press("Escape");
    await expect(
      phone(page).getByTestId("records-browse-sheet"),
    ).toBeHidden({ timeout: 5000 });

    // 2) Six+ records → scrollable Home stream (P0-3)
    for (const text of [
      "기록 하나",
      "기록 둘",
      "기록 셋",
      "기록 넷",
      "기록 다섯",
      "기록 여섯",
    ]) {
      await submit(page, text);
    }
    await expect(phone(page).getByTestId("left-item-row")).toHaveCount(6);
    await phone(page).screenshot({
      path: join(OUT_DIR, "02-six-records-home.png"),
    });

    // 3) Clear schedule stays on Home + Schedule (P0-2)
    await submit(page, "내일 오후 3시 치과");
    await expect(
      phone(page).getByTestId("saved-schedule-feedback"),
    ).toBeVisible();
    await expect(phone(page).getByText("내일 오후 3시 치과")).toBeVisible();
    await phone(page)
      .getByText("내일 오후 3시 치과")
      .scrollIntoViewIfNeeded();
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      text?: string;
      start_time?: string | null;
    }>;
    const dental = inbox.filter((r) => r.text?.includes("치과"));
    expect(dental.length).toBe(1);
    expect(dental[0]?.start_time).toBeTruthy();
    await phone(page).screenshot({
      path: join(OUT_DIR, "03-clear-schedule-home.png"),
    });

    // 4) Ambiguity: 내일 8시 기상 (P0-4 Case A)
    await submit(page, "내일 8시 기상");
    await expect(phone(page).getByTestId("inline-promise")).toBeVisible();
    await expect(phone(page).getByTestId("promise-confirm-morning")).toBeVisible();
    await expect(phone(page).getByTestId("promise-confirm-afternoon")).toBeVisible();
    await phone(page).getByTestId("inline-promise").scrollIntoViewIfNeeded();
    await phone(page).screenshot({
      path: join(OUT_DIR, "04-clarify-내일-8시.png"),
    });

    // 5) Schedule Upcoming
    await phone(page).getByRole("link", { name: /^(일정|Schedule)/ }).click();
    await expect(page).toHaveURL(/\/schedule/);
    await phone(page).getByRole("tab", { name: /예정|Upcoming/i }).click();
    await expect(phone(page).getByText(/치과/).first()).toBeVisible();
    await phone(page).screenshot({
      path: join(OUT_DIR, "05-schedule-upcoming.png"),
    });

    // 6) Alarm sheet — arm alarm flag then open bell (P0-5)
    await page.evaluate((key) => {
      const rows = JSON.parse(localStorage.getItem(key) || "[]") as Array<{
        text?: string;
        alarm?: boolean;
      }>;
      for (const row of rows) {
        if (row.text?.includes("치과")) row.alarm = true;
      }
      localStorage.setItem(key, JSON.stringify(rows));
    }, GUEST_SCHEDULE_KEY);
    await page.reload();
    await phone(page).getByRole("link", { name: /^(일정|Schedule)/ }).click();
    await phone(page).getByRole("tab", { name: /예정|Upcoming/i }).click();
    await expect(phone(page).getByText(/치과/).first()).toBeVisible();
    await phone(page)
      .getByTestId("schedule-compact-row")
      .filter({ hasText: /치과/ })
      .getByRole("button", { name: /알림|Reminder/i })
      .click();
    await expect(page.getByTestId("alarm-preset-list")).toBeVisible({
      timeout: 8000,
    });
    const presets = page.locator('[data-testid^="alarm-preset-"]');
    await expect(presets.first()).toBeVisible();
    await page.getByTestId("alarm-preset-list").scrollIntoViewIfNeeded();
    // Contrast smoke: presets must not render as solid black blocks
    const bg = await presets.first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, color: s.color };
    });
    expect(bg.bg).not.toMatch(/^rgb\(\s*0,\s*0,\s*0\s*\)$/);
    expect(bg.color).not.toMatch(/^rgb\(\s*0,\s*0,\s*0\s*\)$/);
    await page.screenshot({
      path: join(OUT_DIR, "06-alarm-sheet.png"),
      fullPage: false,
    });

    // Sanity: schedule projection linked, not duplicated inbox for dental
    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<{
      text?: string;
      source_id?: string | null;
    }>;
    const dentalSched = schedules.filter((s) => s.text?.includes("치과"));
    expect(dentalSched.length).toBeGreaterThanOrEqual(1);
  });
});
