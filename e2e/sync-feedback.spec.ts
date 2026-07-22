import { test, expect } from "@playwright/test";
import { allCloudSynced } from "../src/lib/syncFeedback";
import {
  resetAppState,
  addThought,
  openContextMenu,
  phone,
  injectSignedInUser,
  blockCloudMutations,
  dismissReleaseOverlay,
  TEST_USER_ID,
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

  test("signed-in cloud write failure shows sync error not success toast", async ({
    page,
  }) => {
    await resetAppState(page);
    await page.route("**/rest/v1/inbox**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "content-range": "0--1/0" },
          body: "[]",
        });
        return;
      }
      await route.continue();
    });
    await blockCloudMutations(page);
    await injectSignedInUser(page);
    await page.waitForFunction(
      ({ userId }) => localStorage.getItem("itjima.__e2e_user_id__") === userId,
      { userId: TEST_USER_ID },
    );

    const text = `Cloud write ${Date.now()}`;
    const frame = phone(page);
    await frame.locator("textarea").first().fill(text);
    await frame.getByRole("button", { name: "Leave it", exact: true }).click();
    await dismissReleaseOverlay(page);
    await page.waitForFunction(
      ({ userId, thoughtText }) => {
        const key = `itjima.${userId}.inbox`;
        const items = JSON.parse(localStorage.getItem(key) || "[]") as {
          text: string;
        }[];
        return items.some((item) => item.text === thoughtText);
      },
      { userId: TEST_USER_ID, thoughtText: text },
    );

    await phone(page)
      .getByRole("alert")
      .getByText("Keeping safe paused for a moment")
      .waitFor({ state: "visible" });
  });
});
