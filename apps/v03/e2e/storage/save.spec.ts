import { test, expect } from "@playwright/test";
import { openReview, confirmAll } from "../helpers";
import { backend, ID } from "./detail-fixture";

test("reviewed save navigates to a reloadable detail and preserves V02 session", async ({ page }) => {
  const api = await backend(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("v02-auth-sentinel", "unchanged"));
  await api.login();
  await openReview(page);
  expect(api.calls).toEqual([]);
  await confirmAll(page);
  await page.getByRole("button", { name: "확인하고 저장", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/collaborations/${ID}$`));
  await expect(page.getByRole("heading", { name: "브랜드 A 캠페인", exact: true })).toBeVisible();
  expect(api.calls).toEqual(["v03_prepare_import", "v03_commit_import"]);
  const reads = api.reads;
  await page.reload();
  await expect(page.getByRole("heading", { name: "브랜드 A 캠페인", exact: true })).toBeVisible();
  expect(api.reads).toBeGreaterThan(reads);
  expect(api.calls).toHaveLength(2);
  expect(await page.evaluate(() => localStorage.getItem("v02-auth-sentinel"))).toBe("unchanged");
  await expect(page.getByRole("button", { name: "확인하고 저장", exact: true })).toHaveCount(0);
});
