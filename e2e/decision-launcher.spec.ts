import { test, expect } from "@playwright/test";
import {
  resetAppState,
  addThought,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
} from "./helpers";

test.describe("Home Decision launcher", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("launcher is hidden with 0 items", async ({ page }) => {
    await expect(phone(page).getByTestId("decision-launcher")).toHaveCount(0);
  });

  test("launcher is visible with 1 item", async ({ page }) => {
    await addThought(page, "Single thought");
    await expect(phone(page).getByTestId("decision-launcher")).toBeVisible();
    await expect(phone(page).getByTestId("decision-launcher-count")).toHaveText(
      "1",
    );
  });

  test("count updates with multiple items", async ({ page }) => {
    const stamp = Date.now();
    await addThought(page, `Launcher first ${stamp}`);
    await addThought(page, `Launcher second ${stamp}`);
    await addThought(page, `Launcher third ${stamp}`);

    await expect(phone(page).getByTestId("decision-launcher-count")).toHaveText(
      "3",
    );
    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(3);
  });

  test("clicking launcher opens DecisionDeck from newest item", async ({
    page,
  }) => {
    const stamp = Date.now();
    const older = `Older thought ${stamp}`;
    const newer = `Newer thought ${stamp}`;
    await addThought(page, older);
    await addThought(page, newer);

    await phone(page).getByTestId("decision-launcher").click();

    const deck = phone(page).getByRole("dialog", { name: "One by one" });
    await deck.waitFor({ state: "visible" });
    await expect(deck.getByLabel("1 / 2")).toBeVisible();
    await expect(
      deck.locator("p").filter({ hasText: newer }).first(),
    ).toBeVisible();
  });
});
