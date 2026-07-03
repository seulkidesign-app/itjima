import { test, expect } from "@playwright/test";
import { allCloudSynced } from "../src/lib/syncFeedback";
import {
  resetAppState,
  addThought,
  openContextMenu,
  phone,
  injectSignedInUser,
  blockCloudMutations,
  getSupabaseProjectId,
} from "./helpers";

test.describe("sync feedback", () => {
  test("allCloudSynced requires every write to succeed", () => {
    expect(allCloudSynced(true, true)).toBe(true);
    expect(allCloudSynced(true, false)).toBe(false);
    expect(allCloudSynced()).toBe(true);
  });

  test("guest delete still shows removed toast", async ({ page }) => {
    await resetAppState(page);
    const text = `Guest delete ${Date.now()}`;
    await addThought(page, text);

    await openContextMenu(page, text);
    await phone(page)
      .getByRole("dialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    await page.getByText("Removed").waitFor({ state: "visible" });
    await expect(phone(page).getByRole("alert")).toHaveCount(0);
  });

  test("signed-in cloud delete failure shows sync error not success toast", async ({
    page,
  }) => {
    test.skip(!getSupabaseProjectId(), "Requires .env with VITE_SUPABASE_PROJECT_ID");

    await resetAppState(page);
    await blockCloudMutations(page);
    await injectSignedInUser(page);

    const text = `Cloud delete ${Date.now()}`;
    await addThought(page, text);

    await openContextMenu(page, text);
    await phone(page)
      .getByRole("dialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    await expect(page.getByText("Removed")).toHaveCount(0);
    await phone(page)
      .getByRole("alert")
      .getByText("Saving paused for a moment")
      .waitFor({ state: "visible" });
  });
});
