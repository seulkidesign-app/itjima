import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  injectSignedInUser,
  mockAdminRole,
  TEST_USER_ID,
} from "./helpers";

async function mockMyAdminStatus(page: Page, isAdmin: boolean) {
  await page.route("**/rest/v1/rpc/get_my_admin_status**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user_id: TEST_USER_ID,
        is_admin: isAdmin,
        admin_count: isAdmin ? 1 : 0,
      }),
    });
  });
  await page.route("**/rest/v1/rpc/get_admin_count**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(isAdmin ? 1 : 0),
    });
  });
}

async function mockNonAdminRole(page: Page) {
  await mockMyAdminStatus(page, false);
  await page.route("**/rest/v1/user_roles**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "*/0" },
      body: "[]",
    });
  });
  await page.route("**/rest/v1/rpc/has_role**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "false",
    });
  });
}

test.describe("Account entry on mobile", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("guest can open account settings from Home", async ({ page }) => {
    const accountButton = page.locator('[data-testid="open-settings"]:visible');
    await expect(accountButton).toBeVisible();
    await expect(accountButton).toHaveAttribute(
      "aria-label",
      /Sign in and settings|로그인 및 설정/,
    );

    await accountButton.click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });
});

test.describe("Admin access on mobile", () => {
  test("admin link appears only for an admin and opens admin page", async ({
    page,
  }) => {
    await resetAppState(page);
    await mockMyAdminStatus(page, true);
    await mockAdminRole(page);
    await injectSignedInUser(page, { awaitAdminRole: true });

    await page.locator('[data-testid="open-settings"]:visible').click();
    const adminLink = page.getByRole("link", { name: "Admin", exact: true });
    await adminLink.waitFor({ state: "visible" });
    await adminLink.click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: "Admin", level: 1 }),
    ).toBeVisible();
  });

  test("signed-in non-admin cannot open /admin directly", async ({ page }) => {
    await resetAppState(page);
    await mockNonAdminRole(page);
    await injectSignedInUser(page);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole("heading", { name: "Admin", level: 1 }),
    ).toHaveCount(0);
  });
});
