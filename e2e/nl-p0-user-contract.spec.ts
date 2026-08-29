import { test, expect, type Page } from "@playwright/test";
import {
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  phone,
  readGuestList,
  resetAppState,
} from "./helpers";

type StoredInbox = {
  text?: string;
  raw_text?: string;
  start_time?: string | null;
  end_time?: string | null;
  temporal_state?: string | null;
};

type StoredSchedule = {
  text?: string;
  start_time?: string;
  end_time?: string;
};

async function capture(page: Page, text: string) {
  const frame = phone(page);
  const input = frame.locator("#capture-input");
  await input.fill(text);
  await frame.getByTestId("capture-submit").click();
}

async function waitForInboxText(page: Page, text: string) {
  await expect
    .poll(async () => {
      const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as StoredInbox[];
      return inbox.some((item) => item.text === text || item.raw_text === text);
    })
    .toBe(true);
}

async function waitForSchedule(page: Page) {
  await expect
    .poll(async () => {
      const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as StoredSchedule[];
      return schedules.length;
    })
    .toBeGreaterThan(0);
}

async function expectNoRoutineCaptureToast(page: Page) {
  await expect(page.getByText("Left it here", { exact: true })).toHaveCount(0);
  await expect(page.getByText("남겨뒀어요", { exact: true })).toHaveCount(0);
}

async function localScheduleHours(page: Page) {
  return page.evaluate((key) => {
    const schedules = JSON.parse(localStorage.getItem(key) || "[]") as Array<{
      start_time?: string;
      end_time?: string;
    }>;
    const item = schedules[0];
    if (!item?.start_time || !item.end_time) return null;
    const start = new Date(item.start_time);
    const end = new Date(item.end_time);
    return {
      startHour: start.getHours(),
      endHour: end.getHours(),
      durationMs: end.getTime() - start.getTime(),
      startMs: start.getTime(),
    };
  }, GUEST_SCHEDULE_KEY);
}

test.describe("NL P0 user-facing contract", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  for (const text of ["내일 청소", "내일 오전에 청소", "내일 오후에 청소"]) {
    test(`${text} never invents 09:00`, async ({ page }) => {
      await capture(page, text);
      await waitForInboxText(page, text);

      const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as StoredInbox[];
      const item = inbox.find((x) => x.text === text || x.raw_text === text);
      expect(item).toBeTruthy();
      expect(item?.start_time ?? null).toBeNull();
      expect(item?.end_time ?? null).toBeNull();

      const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as StoredSchedule[];
      expect(schedules).toHaveLength(0);
      await expect(phone(page).getByText(/9:00\s*(AM|오전)?/i)).toHaveCount(0);
      await expectNoRoutineCaptureToast(page);
    });
  }

  test("내일 3시에 청소 stays unresolved until AM/PM is known", async ({ page }) => {
    const text = "내일 3시에 청소";
    await capture(page, text);
    await waitForInboxText(page, text);

    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as StoredSchedule[];
    expect(schedules).toHaveLength(0);
    await expectNoRoutineCaptureToast(page);
  });

  test("오후 5시에 청소 commits exactly at 17:00 and cleans the title", async ({ page }) => {
    await capture(page, "오후 5시에 청소");
    await waitForSchedule(page);

    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as StoredSchedule[];
    expect(schedules[0]?.text).toBe("청소");
    const local = await localScheduleHours(page);
    expect(local?.startHour).toBe(17);
  });

  test("30분 뒤에 청소 keeps the relative-time meaning", async ({ page }) => {
    const before = Date.now();
    await capture(page, "30분 뒤에 청소");
    await waitForSchedule(page);

    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as StoredSchedule[];
    expect(schedules[0]?.text).toBe("청소");
    const local = await localScheduleHours(page);
    expect(local).not.toBeNull();
    const delta = (local?.startMs ?? 0) - before;
    expect(delta).toBeGreaterThan(29 * 60 * 1000);
    expect(delta).toBeLessThan(31 * 60 * 1000 + 10_000);
  });

  test("내일 5시부터 6시까지 운동 is one range semantic unit, not two schedules", async ({ page }) => {
    const text = "내일 5시부터 6시까지 운동";
    await capture(page, text);
    await waitForInboxText(page, text);

    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as StoredSchedule[];
    expect(schedules).toHaveLength(0);
    await expect(page.getByText("시간이 두 개 있어요", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/more than one time|two times/i)).toHaveCount(0);
  });

  test("내일 오후 5시부터 6시까지 운동 commits a 17:00–18:00 range", async ({ page }) => {
    await capture(page, "내일 오후 5시부터 6시까지 운동");
    await waitForSchedule(page);

    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as StoredSchedule[];
    expect(schedules[0]?.text).toBe("운동");
    const local = await localScheduleHours(page);
    expect(local?.startHour).toBe(17);
    expect(local?.endHour).toBe(18);
    expect(local?.durationMs).toBe(60 * 60 * 1000);
  });

  for (const text of ["밥 먹고 청소", "나중에 청소"]) {
    test(`${text} remains visible as a raw capture without a success toast`, async ({ page }) => {
      await capture(page, text);
      await waitForInboxText(page, text);

      await expect(phone(page).getByText(text, { exact: true }).first()).toBeVisible();
      const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as StoredSchedule[];
      expect(schedules).toHaveLength(0);
      await expectNoRoutineCaptureToast(page);
    });
  }
});
