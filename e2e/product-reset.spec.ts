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
  await frame.getByRole("button", { name: "Capture", exact: true }).click();
  await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
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

    await phone(page).getByRole("link", { name: /^Archive/ }).click();
    await expect(
      phone(page).getByRole("heading", { name: "Archive", exact: true }),
    ).toBeVisible();
    await expect(phone(page).getByText("Travel").first()).toBeVisible();
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_ARCHIVE_KEY)).length).toBe(1);
  });

  test("context menu scheduling keeps Capture until confirmation", async ({ page }) => {
    await submitThought(page, "Dentist tomorrow at 3pm");
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
    await openContextMenu(page, "Dentist tomorrow at 3pm");
    await contextMenuDialog(page)
      .getByRole("menuitem", { name: "Bring it back then", exact: true })
      .click();
    await completeScheduleDialog(page);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
    await gotoScheduleUpcoming(page);
    await expect(phone(page).getByText(/Dentist/i).first()).toBeVisible();
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
    await page.reload();
    await phone(page).getByRole("link", { name: /^Archive/ }).click();
    await expect(phone(page).getByText("Map memory seed").first()).toBeVisible();
    await phone(page).getByRole("button", { name: "Thought map" }).click();
    await expect(phone(page).getByText("Vault › Thought map")).toBeVisible();
  });
});
