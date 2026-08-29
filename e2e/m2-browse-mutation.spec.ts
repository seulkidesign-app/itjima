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
  content_revision?: number;
};

type ScheduleRow = {
  id?: string;
  text?: string;
  source_id?: string | null;
  start_time?: string;
  end_time?: string;
  status?: string;
};

async function submitText(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.locator('form.composer-hero button[type="submit"]').click();
}

async function submitExactTimed(page: Page, text: string) {
  await submitText(page, text);
  await expect(phone(page).getByTestId("saved-schedule-feedback")).toBeVisible();
}

async function allInbox(page: Page): Promise<InboxRow[]> {
  return (await readGuestList(page, GUEST_INBOX_KEY)) as InboxRow[];
}

async function activeInbox(page: Page): Promise<InboxRow[]> {
  const rows = await allInbox(page);
  return rows.filter((row) => !row.status || row.status === "active");
}

async function schedules(page: Page): Promise<ScheduleRow[]> {
  return (await readGuestList(page, GUEST_SCHEDULE_KEY)) as ScheduleRow[];
}

async function openAllRecords(page: Page) {
  const frame = phone(page);
  await frame.getByRole("link", { name: /^Capture$/ }).click();
  await frame.getByTestId("open-browse-search").click();
  await expect(frame.getByTestId("records-browse-sheet")).toBeVisible();
}

async function openScheduleEdit(page: Page, title: string) {
  const frame = phone(page);
  await frame.getByRole("link", { name: /^Schedule/ }).click();
  const row = frame
    .getByTestId("schedule-compact-row")
    .filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByTestId("schedule-row-open-detail").click();
  const detail = page.getByRole("dialog", {
    name: /Record detail|기록 상세/i,
  });
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: /Change time|시간 수정/i }).click();
  await expect(page.getByRole("dialog", { name: "Edit schedule" })).toBeVisible();
}

async function advanceManagerToRangeStep(page: Page) {
  const sheet = page.getByRole("dialog", { name: "Edit schedule" });
  const addTime = sheet.getByRole("button", {
    name: /Add time and end|시간·종료 정하기/i,
  });
  if (await addTime.isVisible().catch(() => false)) {
    await addTime.click();
  }
  await expect(sheet.getByLabel("Schedule title")).toBeVisible();
}

async function saveScheduleSheet(page: Page) {
  const sheet = page.getByRole("dialog", { name: "Edit schedule" });
  const reminder = sheet.getByRole("button", {
    name: /Set a reminder|알림 정하기/i,
  });
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

test.describe("M2 browse & mutation trust", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("1 undated record appears in All records and search", async ({ page }) => {
    const marker = `Undated note ${Date.now()}`;
    await submitText(page, marker);
    await expect(phone(page).getByText(marker).first()).toBeVisible();

    await openAllRecords(page);
    const frame = phone(page);
    await expect(frame.getByTestId("records-browse-list")).toBeVisible();
    await expect(
      frame.getByTestId("records-browse-row").filter({ hasText: marker }),
    ).toHaveCount(1);

    await frame.getByTestId("records-browse-search").fill("Undated note");
    await expect(frame.getByTestId("records-browse-search-results")).toBeVisible();
    await expect(
      frame.getByTestId("records-browse-row").filter({ hasText: marker }),
    ).toHaveCount(1);
  });

  test("2 timed record is one browse row and also on schedule", async ({ page }) => {
    await submitExactTimed(page, "Dentist tomorrow at 3pm");
    const inbox = await activeInbox(page);
    const sched = await schedules(page);
    expect(inbox).toHaveLength(1);
    expect(sched).toHaveLength(1);
    const title = sched[0]!.text!;

    await openAllRecords(page);
    const frame = phone(page);
    await expect(
      frame.getByTestId("records-browse-row").filter({ hasText: title }),
    ).toHaveCount(1);

    await frame.getByTestId("records-browse-search").fill(title.slice(0, 8));
    await expect(
      frame.getByTestId("records-browse-row").filter({ hasText: title }),
    ).toHaveCount(1);

    await frame.getByRole("button", { name: /Close|닫기/i }).first().click().catch(() => {});
    if (await frame.getByTestId("records-browse-sheet").isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    await frame.getByRole("link", { name: /^Schedule/ }).click();
    await expect(frame.getByTestId("schedule-section-upcoming")).toBeVisible();
    await expect(frame.getByText(title).first()).toBeVisible();
  });

  test("3 timed detail text edit syncs browse and schedule", async ({ page }) => {
    await submitExactTimed(page, "Dentist tomorrow at 3pm");
    const before = await schedules(page);
    const original = before[0]!.text!;
    const edited = `Synced title ${Date.now()}`;

    await openAllRecords(page);
    const frame = phone(page);
    await frame.getByTestId("records-browse-row").filter({ hasText: original }).click();
    const detail = page.getByRole("dialog", { name: /Record detail|기록 상세|This thought|이 생각/i });
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: /Edit|수정하기/i }).click();
    await detail.getByLabel(/Edit thought|생각 수정/i).fill(edited);
    await detail.getByRole("button", { name: /Save changes|반영하기/i }).click();

    const afterInbox = await allInbox(page);
    const afterSched = await schedules(page);
    expect(afterInbox[0]?.text).toBe(edited);
    expect(afterSched[0]?.text).toBe(edited);
    expect(afterSched).toHaveLength(1);

    await openAllRecords(page);
    await expect(
      frame.getByTestId("records-browse-row").filter({ hasText: edited }),
    ).toHaveCount(1);
  });

  test("4 datetime edit updates schedule time", async ({ page }) => {
    await submitExactTimed(page, "Dentist tomorrow at 3pm");
    const before = await schedules(page);
    const title = before[0]!.text!;
    const beforeStart = before[0]!.start_time!;

    await openScheduleEdit(page, title);
    await advanceManagerToRangeStep(page);
    const sheet = page.getByRole("dialog", { name: "Edit schedule" });
    const startTime = sheet.getByLabel("Start time");
    const startAllDay = sheet.getByRole("switch", { name: "All-day" }).first();
    if ((await startAllDay.getAttribute("aria-checked")) === "true") {
      await startAllDay.click();
    }
    await startTime.click();
    await startTime.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
    await startTime.pressSequentially("16:30");
    await saveScheduleSheet(page);

    const afterInbox = await allInbox(page);
    const afterSched = await schedules(page);
    expect(afterSched[0]?.start_time).not.toBe(beforeStart);
    expect(afterInbox[0]?.start_time).toBe(afterSched[0]?.start_time);
  });

  test("5 datetime remove keeps record and drops schedule only", async ({ page }) => {
    await submitExactTimed(page, "Dentist tomorrow at 3pm");
    const title = (await schedules(page))[0]!.text!;

    await openAllRecords(page);
    const frame = phone(page);
    await frame.getByTestId("records-browse-row").filter({ hasText: title }).click();
    await page.getByRole("button", { name: /Remove date & time|날짜·시간 지우기/i }).click();

    const inbox = await allInbox(page);
    const sched = await schedules(page);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.status).not.toBe("deleted");
    expect(inbox[0]?.start_time == null || inbox[0]?.start_time === null).toBe(true);
    expect(inbox[0]?.temporal_state).toBe("no_time");
    expect(sched).toHaveLength(0);
  });

  test("6 complete hides from Capture but searchable as done", async ({ page }) => {
    await submitExactTimed(page, "Dentist tomorrow at 3pm");
    const title = (await schedules(page))[0]!.text!;

    const frame = phone(page);
    await frame.getByRole("link", { name: /^Schedule/ }).click();
    await frame
      .getByTestId("schedule-compact-row")
      .filter({ hasText: title })
      .getByTestId("schedule-row-complete")
      .click();

    await expect.poll(async () => (await allInbox(page))[0]?.status).toBe("done");
    expect(await activeInbox(page)).toHaveLength(0);

    await openAllRecords(page);
    const browseRow = frame
      .getByTestId("records-browse-row")
      .filter({ hasText: title })
      .first();
    await expect(browseRow).toBeVisible();
    await expect(browseRow).toHaveAttribute("data-status", "done");

    await frame.getByTestId("records-browse-search").fill(title.slice(0, 6));
    await expect(
      frame.getByTestId("records-browse-row").filter({ hasText: title }),
    ).toHaveCount(1);
  });

  test("7 undo complete restores active across views", async ({ page }) => {
    await submitExactTimed(page, "Dentist tomorrow at 3pm");
    const title = (await schedules(page))[0]!.text!;
    const frame = phone(page);
    await frame.getByRole("link", { name: /^Schedule/ }).click();
    await frame
      .getByTestId("schedule-compact-row")
      .filter({ hasText: title })
      .getByTestId("schedule-row-complete")
      .click();

    await expect.poll(async () => (await allInbox(page))[0]?.status).toBe("done");

    await frame.getByRole("button", { name: /Done ·|완료 ·/i }).click();
    await frame
      .getByTestId("schedule-compact-row")
      .filter({ hasText: title })
      .getByTestId("schedule-row-complete")
      .click();

    await expect.poll(async () => (await allInbox(page))[0]?.status).toBe("active");
    await expect.poll(async () => (await schedules(page))[0]?.status).not.toBe("done");
  });

  test("8 timed delete + undo restores text/time/status/projection", async ({ page }) => {
    await submitExactTimed(page, "Dentist tomorrow at 3pm");
    const beforeInbox = (await allInbox(page))[0]!;
    const beforeSched = (await schedules(page))[0]!;
    const title = beforeSched.text!;

    await openAllRecords(page);
    const frame = phone(page);
    await frame.getByTestId("records-browse-row").filter({ hasText: title }).click();
    const detail = page.getByRole("dialog", { name: /Record detail|기록 상세|This thought|이 생각/i });
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: /Delete|삭제하기/i }).click();

    await expect.poll(async () => (await schedules(page)).length).toBe(0);
    await expect.poll(async () => (await allInbox(page))[0]?.status).toBe("deleted");

    await page
      .getByRole("status")
      .filter({ hasText: /Deleted|삭제했어요/i })
      .getByRole("button", { name: /Undo|되돌리기/i })
      .click();

    await expect.poll(async () => (await allInbox(page))[0]?.status).toBe(beforeInbox.status ?? "active");
    await expect.poll(async () => (await schedules(page)).length).toBe(1);
    const restoredInbox = (await allInbox(page))[0]!;
    const restoredSched = (await schedules(page))[0]!;
    expect(restoredInbox.text).toBe(beforeInbox.text);
    expect(restoredInbox.start_time).toBe(beforeInbox.start_time);
    expect(restoredInbox.temporal_state).toBe("exact_datetime");
    expect(restoredSched.text).toBe(beforeSched.text);
    expect(restoredSched.start_time).toBe(beforeSched.start_time);

    await openAllRecords(page);
    await expect(
      frame.getByTestId("records-browse-row").filter({ hasText: title }),
    ).toHaveCount(1);
  });

  test("9 legacy source_id schedule deep link / edit works", async ({ page }) => {
    const canonicalId = "canonical-legacy-m2";
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(15, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    await page.evaluate(
      ({ inboxKey, scheduleKey, inbox, schedule }) => {
        localStorage.setItem(inboxKey, JSON.stringify([inbox]));
        localStorage.setItem(scheduleKey, JSON.stringify([schedule]));
        window.dispatchEvent(new CustomEvent("itjima:update", { detail: scheduleKey }));
      },
      {
        inboxKey: GUEST_INBOX_KEY,
        scheduleKey: GUEST_SCHEDULE_KEY,
        inbox: {
          id: canonicalId,
          text: "Legacy linked",
          images: [],
          created_at: new Date().toISOString(),
          status: "active",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          temporal_state: "exact_datetime",
          structured_at: new Date().toISOString(),
          content_revision: 0,
        },
        schedule: {
          id: "random-sched-id",
          text: "Legacy linked",
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          alarm: false,
          created_at: new Date().toISOString(),
          source_id: canonicalId,
          status: "active",
        },
      },
    );
    await page.reload();
    await phone(page).getByRole("link", { name: /^Capture$/ }).waitFor({ state: "visible" });

    await page.evaluate((id) => {
      sessionStorage.setItem("itjima.openScheduleEdit", id);
    }, canonicalId);
    await phone(page).getByRole("link", { name: /^Schedule/ }).click();
    await expect(page.getByRole("dialog", { name: "Edit schedule" })).toBeVisible({ timeout: 15_000 });
  });

  test("10 DecisionDeck one-by-one archive is unreachable in V0.2 UI", async ({ page }) => {
    await submitText(page, `Stay undated ${Date.now()}`);
    const frame = phone(page);
    await frame.getByTestId("left-item-more").last().click();
    const menu = frame.getByTestId("inbox-context-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText(/Sort one by one|하나씩 정리하기/i)).toHaveCount(0);
    await expect(menu.getByText(/All records|전체 기록/i)).toBeVisible();
  });
});