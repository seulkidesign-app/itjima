import { test, expect } from "@playwright/test";
import {
  resetAppState,
  addThought,
  phone,
  dismissInlinePromise,
  closeDecisionDeckIfOpen,
  assertDecisionDeckUnreachableFromMenu,
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

  test("··· menu does not open DecisionDeck in V0.2 (M2)", async ({
    page,
  }) => {
    const stamp = Date.now();
    const newer = `Newer thought ${stamp}`;
    await addThought(page, `Older thought ${stamp}`);
    await addThought(page, newer);
    await dismissInlinePromise(page);
    await closeDecisionDeckIfOpen(page);

    await assertDecisionDeckUnreachableFromMenu(page, newer);
    await expect(
      phone(page).getByRole("dialog", { name: "One by one" }),
    ).toHaveCount(0);
  });
});
