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
    await frame.getByRole("button", { name: "Leave it", exact: true }).click();
    await frame.getByText(text, { exact: true }).waitFor({ state: "visible" });
    await frame.getByTestId("inline-promise").waitFor({ state: "visible", timeout: 15_000 });
    await expect(
      page.getByText("Couldn't load a reflection right now"),
    ).toHaveCount(0);
  });

  test("still offers task routing when API fails but date is detected", async ({
    page,
  }) => {
    const text =
      "Tomorrow hospital, pack documents, insurance cards, call clinic";
    const frame = phone(page);
    const input = frame.locator("textarea").first();
    await input.fill(text);
    await frame.getByRole("button", { name: "Leave it", exact: true }).click();
    await frame.getByText(text, { exact: true }).waitFor({ state: "visible" });
    await frame.getByTestId("inline-promise").waitFor({ state: "visible", timeout: 15_000 });
    await expect(
      page.getByText("Couldn't load a reflection right now"),
    ).toHaveCount(0);
  });
});
