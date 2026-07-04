import { test, expect } from "@playwright/test";
import { resetAppState, addThought, phone } from "./helpers";

test.describe("Brain Mirror API failures", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.route("**/api/brain-mirror", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "e2e unavailable" }),
      });
    });
  });

  test("shows quiet feedback when API fails without a date hint", async ({
    page,
  }) => {
    const text =
      "Draft slides and rehearse talk and send invites to the team";
    await addThought(page, text);

    await page
      .getByText("Couldn't load a reflection right now")
      .waitFor({ state: "visible", timeout: 15_000 });
    await expect(phone(page).getByText(text, { exact: true })).toBeVisible();
  });

  test("still offers date schedule when API fails but date is detected", async ({
    page,
  }) => {
    const text =
      "Tomorrow hospital, pack documents, insurance cards, call clinic";
    await addThought(page, text);

    await page
      .getByText("Remember this for then?")
      .waitFor({ state: "visible", timeout: 15_000 });
    await expect(
      page.getByText("Couldn't load a reflection right now"),
    ).toHaveCount(0);
  });
});
