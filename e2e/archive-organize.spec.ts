import { test, expect } from "@playwright/test";
import {
  resetAppState,
  addThought,
  openContextMenu,
  gotoArchiveListView,
  phone,
  CAPTURE_LINK_NAME,
  clickContextMenuItem,
} from "./helpers";

async function saveToArchive(page: import("@playwright/test").Page, text: string) {
  await addThought(page, text);
  await openContextMenu(page, text);
  await clickContextMenuItem(page, "Save to vault");
  await expect(
    phone(page).getByRole("paragraph").filter({ hasText: text }),
  ).toHaveCount(0);
}

test.describe("Archive keyword organize", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("experimental grouping stays unavailable in the v1 release", async ({
    page,
  }) => {
    await saveToArchive(page, `Todo item ${Date.now()}`);
    await saveToArchive(page, `Another note ${Date.now()}`);

    // Stale local overrides must not reactivate a surface locked off for v1.
    await page.evaluate(() => {
      localStorage.setItem(
        "itjima.__feature_overrides__",
        JSON.stringify({ ARCHIVE_AI_GROUPING: true }),
      );
    });
    await page.reload();
    await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor();

    await gotoArchiveListView(page);
    await expect(
      phone(page).getByRole("button", {
        name: "Gather by theme",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: /Group by keywords/i })).toHaveCount(0);
  });
});
