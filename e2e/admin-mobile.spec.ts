import { test, expect } from "@playwright/test";
import {
  resetAppState,
  injectSignedInUser,
  mockAdminRole,
} from "./helpers";

test.describe("Admin on mobile", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await mockAdminRole(page);
    await injectSignedInUser(page, { awaitAdminRole: true });
  });

  test("admin link appears in settings and opens admin page", async ({
    page,
  }) => {
    await page.getByTestId("open-settings").click();
    const adminLink = page.getByRole("link", { name: "Admin", exact: true });
    await adminLink.waitFor({ state: "visible" });
    await adminLink.click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: "Admin", level: 1 }),
    ).toBeVisible();
  });
});
