import { test, expect } from "@playwright/test";
import {
  resetAppState,
  gotoInbox,
  addThought,
  openContextMenu,
  getTabCount,
  readGuestList,
  phone,
  gotoArchiveListView,
  gotoScheduleUpcoming,
  completeScheduleDialog,
  contextMenuDialog,
  clickContextMenuItem,
  GUEST_INBOX_KEY,
  GUEST_ARCHIVE_KEY,
  GUEST_SCHEDULE_KEY,
} from "./helpers";

test.describe("CRUD flows (guest / offline)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("add thought appears in inbox and persists on refresh", async ({
    page,
  }) => {
    const text = `QA thought ${Date.now()}`;
    await addThought(page, text);

    expect(await getTabCount(page, "Throw")).toBe(1);

    await page.reload();
    await phone(page).getByText(text, { exact: true }).first().waitFor({ state: "visible" });

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(1);
    expect((inbox[0] as { text: string }).text).toBe(text);
  });

  test("archive from context menu updates inbox, archive tab, and localStorage", async ({
    page,
  }) => {
    const text = `Archive me ${Date.now()}`;
    await addThought(page, text);

    await openContextMenu(page, text);
    await phone(page)
      .getByRole("dialog")
      .getByRole("button", { name: "Save to vault", exact: true })
      .click();

    await expect(
      phone(page).getByRole("paragraph").filter({ hasText: text }),
    ).toHaveCount(0);
    expect(await getTabCount(page, "Throw")).toBe(0);
    expect(await getTabCount(page, "Archive")).toBe(1);

    await gotoArchiveListView(page);
    await phone(page).getByText(text, { exact: true }).first().waitFor({
      state: "visible",
    });

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    const archive = await readGuestList(page, GUEST_ARCHIVE_KEY);
    expect(inbox.length).toBe(0);
    expect(archive.length).toBe(1);
    expect((archive[0] as { text: string }).text).toBe(text);
  });

  test("delete from context menu removes thought with undo toast", async ({
    page,
  }) => {
    const text = `Delete me ${Date.now()}`;
    await addThought(page, text);

    await openContextMenu(page, text);
    await clickContextMenuItem(page, "Delete");

    await expect(
      phone(page).getByRole("paragraph").filter({ hasText: text }),
    ).toHaveCount(0);
    await page.getByText("Deleted").waitFor({ state: "visible" });

    await page.getByRole("button", { name: "Undo" }).click();
    await phone(page).getByText(text, { exact: true }).first().waitFor({ state: "visible" });
  });

  test("schedule via context menu updates Upcoming tab without refresh", async ({
    page,
  }) => {
    const text = `Tomorrow meeting ${Date.now()}`;
    await addThought(page, text);

    await openContextMenu(page, text);
    await phone(page)
      .getByRole("dialog")
      .getByRole("button", { name: "Bring it back then", exact: true })
      .click();

    await completeScheduleDialog(page);

    await expect(
      phone(page).getByRole("paragraph").filter({ hasText: text }),
    ).toHaveCount(0);
    expect(await getTabCount(page, "Schedule")).toBeGreaterThan(0);

    await gotoScheduleUpcoming(page);
    await phone(page).getByText(text).first().waitFor({ state: "visible" });

    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    expect(schedules.length).toBeGreaterThan(0);
  });

  test("create schedule from Today FAB", async ({ page }) => {
    await phone(page).getByRole("link", { name: /^Schedule/ }).click();
    await phone(page).getByRole("button", { name: "Add task", exact: true }).click();

    const text = `FAB schedule ${Date.now()}`;
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Today" }).click();
    await sheet.getByRole("button", { name: /Pick a time|Add time/i }).click();
    await sheet.getByPlaceholder("What was this again?").fill(text);
    await completeScheduleDialog(page);

    await phone(page).getByText(text).first().waitFor({ state: "visible" });
    expect(await getTabCount(page, "Schedule")).toBe(1);
  });
});
