import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
} from "./helpers";

type InboxRow = {
  id?: string;
  text?: string;
  status?: string;
  start_time?: string | null;
  end_time?: string | null;
  temporal_state?: string | null;
};

type ScheduleRow = {
  id?: string;
  text?: string;
  source_id?: string | null;
  start_time?: string;
  end_time?: string;
};

async function submitExactTimed(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.locator('form.composer-hero button[type="submit"]').click();
  await expect(frame.getByTestId("saved-schedule-feedback")).toBeVisible();
}

async function activeInbox(page: Page): Promise<InboxRow[]> {
  const rows = (await readGuestList(page, GUEST_INBOX_KEY)) as InboxRow[];
  return rows.filter((row) => row.status !== "deleted" && row.status !== "archived");
}

async function schedules(page: Page): Promise<ScheduleRow[]> {
  return (await readGuestList(page, GUEST_SCHEDULE_KEY)) as ScheduleRow[];
}

async function openScheduleEditFromUpcoming(page: Page, title: string) {
  const frame = phone(page);
  await frame.getByRole("link", { name: /^Schedule/ }).click();
  await frame.getByRole("tab", { name: "Upcoming" }).click();
  await expect(frame.getByText(title).first()).toBeVisible();
  await frame.getByRole("button", { name: `Edit ${title}` }).click();
  await expect(page.getByRole("dialog", { name: "Edit schedule" })).toBeVisible();
}

async function advanceManagerToRangeStep(page: Page) {
  const sheet = page.getByRole("dialog", { name: "Edit schedule" });
  const addTime = sheet.getByRole("button", { name: /Add time and end|시간·종료 정하기/i });
  if (await addTime.isVisible().catch(() => false)) {
    await addTime.click();
  }
  await expect(sheet.getByLabel("Schedule title")).toBeVisible();
}

async function saveScheduleSheet(page: Page) {
  const sheet = page.getByRole("dialog", { name: "Edit schedule" });
  const reminder = sheet.getByRole("button", { name: /Set a reminder|알림 정하기/i });
  if (await reminder.isVisible().catch(() => false)) {
    await reminder.click();
  }
  const save = sheet.getByRole("button", { name: /^(Save|저장)\b/ });
  await expect(save).toBeVisible();
  await save.click();

  const notification = page.getByRole("dialog", { name: "Notification" });
  if (await notification.isVisible().catch(() => false)) {
    await notification
      .getByRole("button", { name: "Save without notifications" })
      .click();
  }
  await expect(page.getByRole("dialog", { name: "Edit schedule" })).toHaveCount(0);
}

test.describe("M1 edit / delete synchronization", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("edit sync: text and time update on canonical record and schedule projection", async ({
    page,
  }) => {
    await submitExactTimed(page, "Dentist tomorrow at 3pm");

    const beforeInbox = await activeInbox(page);
    const beforeSchedules = await schedules(page);
    expect(beforeInbox).toHaveLength(1);
    expect(beforeSchedules).toHaveLength(1);
    expect(beforeInbox[0]?.temporal_state).toBe("exact_datetime");
    const recordId = beforeInbox[0]!.id!;
    const originalTitle = beforeSchedules[0]!.text!;
    expect(
      beforeSchedules[0]?.id === recordId ||
        beforeSchedules[0]?.source_id === recordId,
    ).toBe(true);

    await openScheduleEditFromUpcoming(page, originalTitle);
    await advanceManagerToRangeStep(page);

    const sheet = page.getByRole("dialog", { name: "Edit schedule" });
    const editedTitle = `Dentist checkup ${Date.now()}`;
    await sheet.getByLabel("Schedule title").fill(editedTitle);

    const startTime = sheet.getByLabel("Start time");
    await expect(startTime).toBeVisible();
    const startAllDay = sheet.getByRole("switch", { name: "All-day" }).first();
    if ((await startAllDay.getAttribute("aria-checked")) === "true") {
      await startAllDay.click();
    }
    await startTime.click();
    await startTime.press(
      process.platform === "darwin" ? "Meta+a" : "Control+a",
    );
    await startTime.pressSequentially("16:00");
    await expect(startTime).toHaveValue("16:00");

    const beforeStart = beforeSchedules[0]!.start_time!;
    await saveScheduleSheet(page);

    await phone(page).getByRole("tab", { name: "Upcoming" }).click();
    await expect(phone(page).getByText(editedTitle).first()).toBeVisible();
    await expect(phone(page).getByText(originalTitle, { exact: true })).toHaveCount(0);

    const afterInbox = await activeInbox(page);
    const afterSchedules = await schedules(page);
    expect(afterSchedules).toHaveLength(1);
    expect(afterInbox).toHaveLength(1);
    expect(afterInbox[0]?.text).toBe(editedTitle);
    expect(afterSchedules[0]?.text).toBe(editedTitle);
    expect(
      afterSchedules[0]?.id === recordId ||
        afterSchedules[0]?.source_id === recordId,
    ).toBe(true);

    expect(afterSchedules[0]?.start_time).not.toBe(beforeStart);
    expect(afterInbox[0]?.start_time).toBe(afterSchedules[0]?.start_time);

    // Read hours in the page TZ (Playwright worker TZ can differ from Chromium).
    const localHours = await page.evaluate((iso) => new Date(iso).getHours(), afterSchedules[0]!.start_time!);
    const localMinutes = await page.evaluate(
      (iso) => new Date(iso).getMinutes(),
      afterSchedules[0]!.start_time!,
    );
    expect(localHours).toBe(16);
    expect(localMinutes).toBe(0);
  });

  test("delete sync: removing timed record clears canonical and projection", async ({
    page,
  }) => {
    await submitExactTimed(page, "Dentist tomorrow at 3pm");

    const beforeInbox = await activeInbox(page);
    const beforeSchedules = await schedules(page);
    expect(beforeInbox).toHaveLength(1);
    expect(beforeSchedules).toHaveLength(1);
    const recordId = beforeInbox[0]!.id!;
    const title = beforeSchedules[0]!.text!;

    const frame = phone(page);
    await frame.getByRole("link", { name: /^Schedule/ }).click();
    await frame.getByRole("tab", { name: "Calendar" }).click();

    const tomorrowDay = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.getDate();
    });
    const needsNextMonth = await page.evaluate(() => {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return (
        tomorrow.getMonth() !== now.getMonth() ||
        tomorrow.getFullYear() !== now.getFullYear()
      );
    });
    if (needsNextMonth) {
      await frame.getByRole("button", { name: "Next month" }).click();
    }

    await page.locator(`[data-cal-day="${tomorrowDay}"]`).first().click();

    // Day detail panel row (not the hidden month-grid preview).
    const dayEvent = frame
      .locator("li")
      .filter({ hasText: title })
      .filter({ hasText: /\d{2}:\d{2}/ })
      .first();
    await expect(dayEvent).toBeVisible();
    await dayEvent.scrollIntoViewIfNeeded();

    const box = await dayEvent.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + Math.min(24, box!.width / 2), box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(750);
    await page.mouse.up();

    const deleteBtn = page.getByRole("button", { name: /^(Delete|삭제하기)$/ });
    await expect(deleteBtn).toBeVisible({ timeout: 8_000 });
    await deleteBtn.evaluate((el) => (el as HTMLButtonElement).click());

    await expect.poll(async () => (await schedules(page)).length).toBe(0);

    const afterInbox = await activeInbox(page);
    const afterSchedules = await schedules(page);
    expect(afterSchedules).toHaveLength(0);
    expect(afterInbox.filter((row) => row.id === recordId)).toHaveLength(0);

    const rawSchedules = (await readGuestList(
      page,
      GUEST_SCHEDULE_KEY,
    )) as ScheduleRow[];
    expect(
      rawSchedules.filter(
        (row) => row.id === recordId || row.source_id === recordId,
      ),
    ).toHaveLength(0);

    await frame.getByRole("tab", { name: "Upcoming" }).click();
    await expect(frame.getByText(title, { exact: true })).toHaveCount(0);
  });
});
