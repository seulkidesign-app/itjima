import { test, expect } from "@playwright/test";
import { resetAppState, phone } from "./helpers";

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

  test("shows release card quietly when API fails without a date hint", async ({
    page,
  }) => {
    const text =
      "Quarterly planning merge roadmap hiring budget office move vendor contracts without clear next steps or dates anywhere in sight";
    const frame = phone(page);
    const input = frame.locator("textarea").first();
    await input.fill(text);
    await frame.locator('form.composer-hero button[type="submit"]').click();
    await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
    await expect(frame.getByTestId("inline-promise")).toHaveCount(0);
    await expect(frame.getByTestId("schedule-commitment-card")).toHaveCount(0);
    await expect(
      page.getByText("Couldn't load a reflection right now"),
    ).toHaveCount(0);
  });

  test("still offers a real schedule commitment when API fails but date is detected", async ({
    page,
  }) => {
    const text =
      "Tomorrow hospital, pack documents, insurance cards, call clinic";
    const frame = phone(page);
    const input = frame.locator("textarea").first();
    await input.fill(text);
    await frame.locator('form.composer-hero button[type="submit"]').click();
    await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });

    const commitment = frame.getByTestId("schedule-commitment-card");
    await expect(commitment).toHaveCount(1);
    await expect(commitment.getByTestId("commitment-date")).toContainText(/Tomorrow|Aug/i);
    await expect(
      page.getByText("Couldn't load a reflection right now"),
    ).toHaveCount(0);
  });
});
