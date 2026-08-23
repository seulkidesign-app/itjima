import { test, expect } from "@playwright/test";
import {
  resetAppState,
  addThought,
  openContextMenu,
  getTabCount,
  readGuestList,
  phone,
  gotoArchiveListView,
  gotoScheduleUpcoming,
  completeScheduleDialog,
  clickContextMenuItem,
  CAPTURE_LINK_NAME,
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

    expect(await getTabCount(page, "Capture")).toBe(1);

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
    await clickContextMenuItem(page, "Save to vault");

    await expect(
      phone(page).getByRole("paragraph").filter({ hasText: text }),
    ).toHaveCount(0);
    expect(await getTabCount(page, "Capture")).toBe(0);
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
    await clickContextMenuItem(page, "Bring it back then");

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

  test("create schedule from home natural-language capture", async ({ page }) => {
    await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).click();

    const stamp = Date.now();
    const title = `Home capture schedule ${stamp}`;
    const input = phone(page).locator("#capture-input");
    await input.fill(`${title} tomorrow at 3 PM`);
    await phone(page).getByTestId("capture-submit").click();

    const saved = phone(page).getByTestId("saved-schedule-feedback");
    const looksRight = phone(page).getByRole("button", { name: /Looks right|맞아요/i });
    const addToSchedule = phone(page).getByRole("button", {
      name: "Add to schedule",
      exact: true,
    });
    if (await saved.isVisible().catch(() => false)) {
      // V02-08C auto-commit
    } else if (await looksRight.isVisible().catch(() => false)) {
      await looksRight.click();
    } else if (await addToSchedule.isVisible().catch(() => false)) {
      await addToSchedule.click();
    } else {
      await openContextMenu(page, title);
      await clickContextMenuItem(page, "Bring it back then");
      await completeScheduleDialog(page);
    }

    const notification = page.getByRole("dialog", { name: "Notification" });
    if (await notification.isVisible().catch(() => false)) {
      await notification
        .getByRole("button", { name: "Save without notifications" })
        .click();
    }

    await expect.poll(() => getTabCount(page, "Schedule")).toBeGreaterThan(0);
    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<{
      text?: string;
    }>;
    expect(schedules.some((s) => (s.text ?? "").includes(title))).toBe(true);
    await expect(
      phone(page).getByRole("button", { name: "Add task", exact: true }),
    ).toHaveCount(0);
  });
});
