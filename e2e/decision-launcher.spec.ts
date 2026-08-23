import { test, expect } from "@playwright/test";
import {
  resetAppState,
  addThought,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  dismissInlinePromise,
  closeDecisionDeckIfOpen,
  openDecisionDeckFromMenu,
} from "./helpers";

test.describe("Home Decision launcher (demoted)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("sticky launcher is gone from Capture primary surface", async ({
    page,
  }) => {
    await expect(phone(page).getByTestId("decision-launcher")).toHaveCount(0);
    await addThought(page, "Single thought");
    await expect(phone(page).getByTestId("decision-launcher")).toHaveCount(0);
  });

  test("··· menu still opens DecisionDeck from newest item", async ({
    page,
  }) => {
    const stamp = Date.now();
    const older = `Older thought ${stamp}`;
    const newer = `Newer thought ${stamp}`;
    await addThought(page, older);
    await addThought(page, newer);
    await dismissInlinePromise(page);
    await closeDecisionDeckIfOpen(page);

    await openDecisionDeckFromMenu(page, newer);

    const deck = phone(page).getByRole("dialog", { name: "One by one" });
    await expect(deck.getByLabel("1 / 2")).toBeVisible();
    await expect(
      deck.locator("p").filter({ hasText: newer }).first(),
    ).toBeVisible();

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(2);
  });
});
