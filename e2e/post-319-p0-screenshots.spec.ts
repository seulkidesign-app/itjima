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

async function homeScrollMetrics(page: Page) {
  return phone(page)
    .locator(".home-chat-lane.chat-scroll")
    .evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollTop: el.scrollTop,
    }));
}

async function scrollHomeLane(page: Page, top: number) {
  await phone(page)
    .locator(".home-chat-lane.chat-scroll")
    .evaluate((el, nextTop) => {
      el.scrollTo({ top: nextTop, behavior: "instant" });
    }, top);
}

test.describe("POST-319 Manual QA · P0 screenshots", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.setTimeout(120_000);

  test("capture P0 acceptance states", async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true });
    await resetKo(page);

    await phone(page).screenshot({
      path: join(OUT_DIR, "01-empty-home.png"),
    });

    await phone(page).getByTestId("open-browse-search").click();
    await expect(phone(page).getByTestId("records-browse-sheet")).toBeVisible();
    await phone(page).screenshot({
      path: join(OUT_DIR, "01b-browse-search.png"),
    });
    await page.keyboard.press("Escape");
    await expect(phone(page).getByTestId("records-browse-sheet")).toBeHidden({
      timeout: 5000,
    });

    const streamTexts = [
      "기록 하나",
      "기록 둘",
      "기록 셋",
      "기록 넷",
      "기록 다섯",
      "기록 여섯",
      "기록 일곱",
      "기록 여덟",
      "기록 아홉",
      "기록 열",
    ];
    for (const text of streamTexts) {
      await submit(page, text);
    }
    await expect(phone(page).getByTestId("left-item-row")).toHaveCount(
      streamTexts.length,
    );

    await expect
      .poll(async () => {
        const metrics = await homeScrollMetrics(page);
        return metrics.scrollHeight > metrics.clientHeight;
      })
      .toBe(true);

    const metrics = await homeScrollMetrics(page);
    await scrollHomeLane(page, metrics.scrollHeight);
    await expect
      .poll(async () => (await homeScrollMetrics(page)).scrollTop)
      .toBeGreaterThan(0);
    await expect(phone(page).getByText("기록 열")).toBeVisible();

    await scrollHomeLane(page, 0);
    await expect
      .poll(async () => (await homeScrollMetrics(page)).scrollTop)
      .toBe(0);
    await expect(phone(page).getByText("기록 하나")).toBeVisible();

    await scrollHomeLane(page, metrics.scrollHeight);
    await expect
      .poll(async () => (await homeScrollMetrics(page)).scrollTop)
      .toBeGreaterThan(0);
    await phone(page).screenshot({
      path: join(OUT_DIR, "02-six-records-home.png"),
    });

    await submit(page, "내일 오후 3시 치과");
    await expect(phone(page).getByTestId("saved-schedule-feedback")).toBeVisible();
    await expect(phone(page).getByText("내일 오후 3시 치과")).toBeVisible();
    await phone(page).getByText("내일 오후 3시 치과").scrollIntoViewIfNeeded();

    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      id?: string;
      text?: string;
      start_time?: string | null;
    }>;
    const dentalInbox = inbox.filter((record) => record.text?.includes("치과"));
    expect(dentalInbox.length).toBe(1);
    expect(dentalInbox[0]?.id).toBeTruthy();
    expect(dentalInbox[0]?.start_time).toBeTruthy();

    const schedulesAfterDental = (await readGuestList(
      page,
      GUEST_SCHEDULE_KEY,
    )) as Array<{
      id?: string;
      text?: string;
      source_id?: string | null;
    }>;
    const dentalSched = schedulesAfterDental.filter(
      (schedule) =>
        schedule.text?.includes("치과") ||
        schedule.source_id === dentalInbox[0]?.id,
    );
    expect(dentalSched.length).toBe(1);
    expect(dentalSched[0]?.source_id).toBe(dentalInbox[0]?.id);

    await phone(page).screenshot({
      path: join(OUT_DIR, "03-clear-schedule-home.png"),
    });

    await submit(page, "내일 8시 기상");
    await expect(phone(page).getByTestId("inline-promise")).toBeVisible();
    await expect(phone(page).getByTestId("promise-confirm-morning")).toBeVisible();
    await expect(phone(page).getByTestId("promise-confirm-afternoon")).toBeVisible();
    await phone(page).getByTestId("inline-promise").scrollIntoViewIfNeeded();
    await phone(page).screenshot({
      path: join(OUT_DIR, "04-clarify-내일-8시.png"),
    });

    const scheduleCountBeforeB = (
      (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<unknown>
    ).length;
    await submit(page, "8시에 걷기 운동");
    const caseBPromise = phone(page)
      .getByTestId("inline-promise")
      .filter({ hasText: /걷기|8시/ });
    await expect(caseBPromise).toBeVisible();
    await expect(caseBPromise).toHaveAttribute(
      "data-confirmation-reason",
      "assumed_meridiem",
    );
    await expect(caseBPromise.getByTestId("promise-confirm-morning")).toBeVisible();
    await expect(caseBPromise.getByTestId("promise-confirm-afternoon")).toBeVisible();
    const scheduleCountAfterB = (
      (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<unknown>
    ).length;
    expect(scheduleCountAfterB).toBe(scheduleCountBeforeB);
    const walkInbox = (
      (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
        text?: string;
        start_time?: string | null;
      }>
    ).filter((record) => record.text?.includes("걷기 운동"));
    expect(walkInbox.length).toBe(1);
    expect(walkInbox[0]?.start_time).toBeFalsy();

    // Unified Schedule: Today and Upcoming live on the same surface.
    await phone(page).getByRole("link", { name: /^(일정|Schedule)/ }).click();
    await expect(page).toHaveURL(/\/schedule/);
    await expect(phone(page).getByTestId("schedule-section-today")).toBeVisible();
    await expect(phone(page).getByTestId("schedule-section-upcoming")).toBeVisible();
    await expect(phone(page).getByText(/치과/).first()).toBeVisible();
    await phone(page).screenshot({
      path: join(OUT_DIR, "05-schedule-unified.png"),
    });

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
    await expect(phone(page).getByText(/치과/).first()).toBeVisible();
    await phone(page)
      .getByTestId("schedule-compact-row")
      .filter({ hasText: /치과/ })
      .getByRole("button", { name: /알림|Reminder/i })
      .click();
    await expect(page.getByTestId("schedule-alarm-sheet")).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByTestId("alarm-preset-list")).toBeVisible();
    const presets = page.locator(
      '[data-testid="schedule-alarm-sheet"] [data-testid^="alarm-preset-"]',
    );
    await expect(presets.first()).toBeVisible();
    await page.getByTestId("alarm-preset-list").scrollIntoViewIfNeeded();
    const bg = await presets.first().evaluate((el) => {
      const style = getComputedStyle(el);
      return { bg: style.backgroundColor, color: style.color };
    });
    expect(bg.bg).not.toMatch(/^rgb\(\s*0,\s*0,\s*0\s*\)$/);
    expect(bg.color).not.toMatch(/^rgb\(\s*0,\s*0,\s*0\s*\)$/);
    await page.screenshot({
      path: join(OUT_DIR, "06-alarm-sheet.png"),
      fullPage: false,
    });

    const finalInbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      id?: string;
      text?: string;
    }>;
    const finalDental = finalInbox.filter((record) => record.text?.includes("치과"));
    expect(finalDental.length).toBe(1);
    const finalSchedules = (await readGuestList(
      page,
      GUEST_SCHEDULE_KEY,
    )) as Array<{
      text?: string;
      source_id?: string | null;
    }>;
    const finalDentalSched = finalSchedules.filter(
      (schedule) =>
        schedule.text?.includes("치과") ||
        schedule.source_id === finalDental[0]?.id,
    );
    expect(finalDentalSched.length).toBe(1);
    expect(finalDentalSched[0]?.source_id).toBe(finalDental[0]?.id);
  });
});