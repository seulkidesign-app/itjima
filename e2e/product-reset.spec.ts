import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  readGuestList,
  openContextMenu,
  contextMenuDialog,
  completeScheduleDialog,
  gotoScheduleUpcoming,
  GUEST_INBOX_KEY,
  GUEST_ARCHIVE_KEY,
  GUEST_SCHEDULE_KEY,
} from "./helpers";

async function submitThought(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.locator('form.composer-hero button[type="submit"]').click();
  // Timed captures may leave Capture via saved-schedule feedback instead of a list row.
  await expect
    .poll(async () => {
      const hasFeedback = await frame
        .getByTestId("saved-schedule-feedback")
        .isVisible()
        .catch(() => false);
      const hasRow = await frame
        .getByText(text, { exact: true })
        .first()
        .isVisible()
        .catch(() => false);
      return hasFeedback || hasRow;
    })
    .toBe(true);
}

test.describe("Current product information architecture", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("Capture to context menu to Archive preserves the original text", async ({ page }) => {
    await submitThought(page, "Travel");
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    await openContextMenu(page, "Travel");
    await contextMenuDialog(page)
      .getByRole("menuitem", { name: "Save to vault", exact: true })
      .click();

    await page.goto("/archive?lang=en");
    await expect(
      phone(page).getByRole("heading", { name: "Archive", exact: true }),
    ).toBeVisible();
    await expect(phone(page).getByText("Travel").first()).toBeVisible();
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_ARCHIVE_KEY)).length).toBe(1);
  });

  test("context menu scheduling keeps Capture until confirmation", async ({ page }) => {
    // Avoid NL "task"/"schedule_*" intents that skip FocusScheduleSheet.
    await submitThought(page, "Blue notebook sketch");
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
    await openContextMenu(page, "Blue notebook sketch");
    await contextMenuDialog(page)
      .getByRole("menuitem", { name: "Bring it back then", exact: true })
      .click();
    await completeScheduleDialog(page);
    // M1/M2: canonical inbox record is kept; schedule is a derived projection.
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
    await gotoScheduleUpcoming(page);

    // The shared dialog helper chooses Today. Around midnight/late-night CI runs,
    // that default can already fall into the unified view's collapsed Past bucket.
    // The contract under test is projection reachability, not a specific time bucket.
    const row = phone(page).getByText(/Blue notebook/i).first();
    if (!(await row.isVisible().catch(() => false))) {
      const past = phone(page).getByRole("button", { name: /^Past\s*·/i });
      if (await past.isVisible().catch(() => false)) await past.click();
    }
    await expect(row).toBeVisible();
  });

  test("legacy thought map remains behind its feature flag", async ({ page }) => {
    await page.evaluate(({ archiveKey }) => {
      localStorage.setItem(
        "itjima.__feature_overrides__",
        JSON.stringify({ ARCHIVE_THOUGHT_MAP: true, ARCHIVE_AI_GROUPING: true }),
      );
      localStorage.setItem(
        archiveKey,
        JSON.stringify([
          {
            id: "qa-map",
            text: "Map memory seed",
            images: [],
            created_at: new Date().toISOString(),
          },
        ]),
      );
    }, { archiveKey: GUEST_ARCHIVE_KEY });
    await page.goto("/archive?lang=en");
    await expect(phone(page).getByText("Map memory seed").first()).toBeVisible();
    await phone(page).getByRole("button", { name: "Thought map" }).click();
    await expect(phone(page).getByText("Vault › Thought map")).toBeVisible();
  });
});
