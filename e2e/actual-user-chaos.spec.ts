import { test, expect, type Page } from "@playwright/test";
import {
  phone,
  GUEST_INBOX_KEY,
  GUEST_ARCHIVE_KEY,
  GUEST_SCHEDULE_KEY,
  readGuestList,
  openContextMenuRaw,
  clickContextMenuItem,
} from "./helpers";

type InboxRow = {
  id: string;
  text?: string;
  raw_text?: string | null;
  status?: string;
  temporal_state?: string | null;
  content_revision?: number;
};

type ScheduleRow = {
  id: string;
  source_id?: string | null;
  text?: string;
  raw_text?: string | null;
  all_day?: boolean;
  start_all_day?: boolean;
  start_time?: string;
};

type ArchiveRow = {
  id: string;
  source_id?: string | null;
  text?: string;
  raw_text?: string | null;
};

async function resetKo(page: Page) {
  await page.goto("/app");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("itjima.")) localStorage.removeItem(key);
    }
    localStorage.setItem("itjima_lang", "ko");
    localStorage.setItem("itjima.swipe.tutorial.done", "1");
    sessionStorage.clear();
  });
  await page.reload();
  await phone(page).getByRole("link", { name: /^남기기$/ }).waitFor();
}

async function submit(page: Page, text: string) {
  const frame = phone(page);
  const textarea = frame.locator("textarea").first();
  await textarea.fill(text);
  await frame
    .getByRole("button", { name: /^(남기기|던지기)$/, exact: false })
    .click();
}

async function inboxRows(page: Page) {
  return (await readGuestList(page, GUEST_INBOX_KEY)) as InboxRow[];
}

async function scheduleRows(page: Page) {
  return (await readGuestList(page, GUEST_SCHEDULE_KEY)) as ScheduleRow[];
}

async function archiveRows(page: Page) {
  return (await readGuestList(page, GUEST_ARCHIVE_KEY)) as ArchiveRow[];
}

async function waitForScheduleCount(page: Page, count: number) {
  await expect.poll(async () => (await scheduleRows(page)).length).toBe(count);
}

function assumedMeridiemPromise(page: Page) {
  return phone(page).locator(
    '[data-testid="inline-promise"][data-confirmation-reason="assumed_meridiem"]',
  );
}

test.describe("Actual user chaos — temporal state integrity", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await resetKo(page);
  });

  test("an old clarification stays bound to its own record after a newer exact capture", async ({
    page,
  }) => {
    await submit(page, "내일 8시 운동");

    const oldPromise = assumedMeridiemPromise(page);
    await expect(oldPromise).toBeVisible();
    await expect(oldPromise).toContainText("8시는 언제인가요?");

    const oldInbox = (await inboxRows(page)).find(
      (row) => row.text === "내일 8시 운동",
    );
    expect(oldInbox).toBeTruthy();

    await submit(page, "모레 오후 3시 치과");
    await waitForScheduleCount(page, 1);

    const newerInbox = (await inboxRows(page)).find(
      (row) => row.text === "모레 오후 3시 치과",
    );
    expect(newerInbox).toBeTruthy();
    expect(newerInbox?.id).not.toBe(oldInbox?.id);

    // The ignored old question is still actionable, but it must only mutate
    // the record it belongs to — never whichever capture happened most recently.
    await expect(oldPromise).toBeVisible();
    await oldPromise.getByTestId("promise-confirm-no_time").click();
    await waitForScheduleCount(page, 2);

    const schedules = await scheduleRows(page);
    expect(new Set(schedules.map((row) => row.source_id)).size).toBe(2);
    expect(schedules.some((row) => row.source_id === oldInbox?.id)).toBe(true);
    expect(schedules.some((row) => row.source_id === newerInbox?.id)).toBe(true);

    const sourceAfter = (await inboxRows(page)).find(
      (row) => row.id === oldInbox?.id,
    );
    expect(sourceAfter?.text).toBe("내일 8시 운동");
  });

  test("pending AM/PM clarification survives reload and resolves without rewriting raw text", async ({
    page,
  }) => {
    await submit(page, "내일 8시 운동");
    const before = (await inboxRows(page)).find(
      (row) => row.text === "내일 8시 운동",
    );
    expect(before).toBeTruthy();
    expect(before?.temporal_state).toBe("ambiguous");
    await waitForScheduleCount(page, 0);

    await page.reload();
    await phone(page).getByRole("link", { name: /^남기기$/ }).waitFor();

    const promise = assumedMeridiemPromise(page);
    await expect(promise).toBeVisible();
    await expect(promise).toContainText("8시는 언제인가요?");
    await promise.getByTestId("promise-confirm-afternoon").click();
    await waitForScheduleCount(page, 1);

    const after = (await inboxRows(page)).find((row) => row.id === before?.id);
    expect(after?.text).toBe("내일 8시 운동");
    expect(after?.temporal_state).toBe("exact_datetime");

    const projection = (await scheduleRows(page)).find(
      (row) => row.source_id === before?.id,
    );
    expect(projection).toBeTruthy();
    expect(projection?.raw_text).toBe("내일 8시 운동");
    expect(projection?.text).toContain("운동");
  });

  test("editing a multi-clock clarification into one exact plan commits that same record", async ({
    page,
  }) => {
    const original = "내일 오후 3시 운동하고 오후 5시 병원";
    const corrected = "내일 오후 4시 운동";
    await submit(page, original);

    const promise = phone(page).locator(
      '[data-testid="inline-promise"][data-confirmation-reason="multiple_clocks"]',
    );
    await expect(promise).toBeVisible();

    const originalInbox = (await inboxRows(page)).find(
      (row) => row.text === original,
    );
    expect(originalInbox).toBeTruthy();
    await waitForScheduleCount(page, 0);

    await promise.getByTestId("promise-edit-input").click();
    const textarea = phone(page).locator("textarea").first();
    await expect(textarea).toHaveValue(original);
    await textarea.fill(corrected);
    await phone(page)
      .getByRole("button", { name: /^(남기기|던지기)$/, exact: false })
      .click();

    // This is the key chaos contract: editing the unresolved record must not
    // leave old copy paired with a new timestamp or create a second source row.
    await waitForScheduleCount(page, 1);

    const inbox = await inboxRows(page);
    const sameRecord = inbox.find((row) => row.id === originalInbox?.id);
    expect(sameRecord?.text).toBe(corrected);
    expect(inbox.filter((row) => row.text === corrected)).toHaveLength(1);
    expect(sameRecord?.temporal_state).toBe("exact_datetime");

    const projection = (await scheduleRows(page)).find(
      (row) => row.source_id === originalInbox?.id,
    );
    expect(projection).toBeTruthy();
    expect(projection?.text).toContain("운동");
    expect(projection?.start_time).toBeTruthy();
  });

  test("delete → undo → reload restores one fuzzy projection and one canonical record", async ({
    page,
  }) => {
    const text = "내일 오후 운동";
    await submit(page, text);
    await waitForScheduleCount(page, 1);

    const source = (await inboxRows(page)).find((row) => row.text === text);
    expect(source).toBeTruthy();
    expect(source?.temporal_state).toBe("fuzzy_time");
    await expect(phone(page).getByTestId("saved-schedule-feedback")).toBeVisible();

    await openContextMenuRaw(page, text);
    await clickContextMenuItem(page, "삭제하기");
    await waitForScheduleCount(page, 0);

    const deleted = (await inboxRows(page)).find((row) => row.id === source?.id);
    expect(deleted?.status).toBe("deleted");
    await expect(phone(page).getByTestId("saved-schedule-feedback")).toHaveCount(0);

    const undo = page.getByRole("button", { name: "되돌리기", exact: true }).last();
    await expect(undo).toBeVisible();
    await undo.click();
    await waitForScheduleCount(page, 1);

    const restored = (await inboxRows(page)).find((row) => row.id === source?.id);
    expect(restored?.status).not.toBe("deleted");
    expect(restored?.temporal_state).toBe("fuzzy_time");

    let projections = (await scheduleRows(page)).filter(
      (row) => row.source_id === source?.id,
    );
    expect(projections).toHaveLength(1);
    expect(projections[0]?.raw_text).toBe(text);

    await page.reload();
    await phone(page).getByRole("link", { name: /^남기기$/ }).waitFor();
    projections = (await scheduleRows(page)).filter(
      (row) => row.source_id === source?.id,
    );
    expect(projections).toHaveLength(1);
    expect(
      (await inboxRows(page)).filter((row) => row.id === source?.id),
    ).toHaveLength(1);
  });

  test("structured timed records fail closed before archive can orphan the schedule", async ({
    page,
  }) => {
    const text = "모레 오후 4시 안과";
    await submit(page, text);
    await waitForScheduleCount(page, 1);

    const source = (await inboxRows(page)).find((row) => row.text === text);
    expect(source).toBeTruthy();
    expect(source?.temporal_state).toBe("exact_datetime");
    const projection = (await scheduleRows(page)).find(
      (row) => row.source_id === source?.id,
    );
    expect(projection).toBeTruthy();

    await openContextMenuRaw(page, text);
    const menu = page.getByTestId("inbox-context-menu");
    await expect(
      menu.getByRole("menuitem", { name: "보관함에 맡기기", exact: true }),
    ).toHaveCount(0);

    // The dangerous transition never starts: source and projection remain one
    // coherent record, and no archive copy is created behind the user's back.
    expect((await inboxRows(page)).filter((row) => row.id === source?.id)).toHaveLength(1);
    expect(
      (await scheduleRows(page)).filter((row) => row.source_id === source?.id),
    ).toHaveLength(1);
    expect(await archiveRows(page)).toHaveLength(0);
  });
});
