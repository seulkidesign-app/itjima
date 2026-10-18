import { test, expect } from "@playwright/test";

import { backend, ID } from "./detail-fixture";

test("manual save navigates to a reloadable detail and preserves V02 session", async ({ page }) => {
  const api = await backend(page);
  await page.goto("/#/");
  await page.evaluate(() => localStorage.setItem("v02-auth-sentinel", "unchanged"));
  await api.login();
  await page.goto('/#/brief/new');
  await page.getByRole('button',{name:'원본 미리보기',exact:false}).click();
  await page.getByRole('button',{name:'직접 입력하기',exact:false}).click();
  await page.getByLabel('협찬 이름',{exact:true}).fill('브랜드 A 캠페인');
  expect(api.calls).toEqual([]);
  await page.getByRole('button',{name:'저장 전 요약 보기',exact:true}).click();
  await page.getByRole('checkbox').check();
  await page.getByRole("button", { name: "확인하고 실제 등록", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/collaborations/${ID}$`));
  await expect(page.getByRole("heading", { name: "브랜드 A 캠페인", exact: true })).toBeVisible();
  expect(api.calls).toEqual(["v03_prepare_manual_import", "v03_commit_manual_import"]);
  const reads = api.reads;
  await page.reload();
  await expect(page.getByRole("heading", { name: "브랜드 A 캠페인", exact: true })).toBeVisible();
  expect(api.reads).toBeGreaterThan(reads);
  expect(api.calls).toHaveLength(2);
  expect(await page.evaluate(() => localStorage.getItem("v02-auth-sentinel"))).toBe("unchanged");
  await expect(page.getByRole("button", { name: "확인하고 실제 등록", exact: true })).toHaveCount(0);
});
