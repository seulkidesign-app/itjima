import { test, expect } from "@playwright/test";
import { backend, fixture, ID } from "./detail-fixture";
const route = `/#/collaborations/${ID}`;
test("direct URL requires login and loads after login without changing URL", async ({ page }) => {
  const api = await backend(page);
  await page.goto(route);
  await expect(page.getByText("협찬을 보려면 위의 V03 계정에서 로그인해주세요.")).toBeVisible();
  expect(api.reads).toBe(0);
  await api.login();
  await expect(page.getByRole("heading", { name: "브랜드 A 캠페인", exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/collaborations/${ID}$`));
});
test("mobile detail displays dates, tasks, unresolved constraints and private original", async ({ page }) => {
  const api = await backend(page); await page.goto(route); await api.login();
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.getByRole("heading", { name: "브랜드 A 캠페인", exact: true })).toBeVisible();
  const dates = page.getByRole("region", { name: "주요 일정" });
  await expect(dates).toContainText("2026. 10. 20."); await expect(dates).toContainText("2026. 10. 23.");
  await expect(page.getByRole("region", { name: "제작 제약조건" })).toContainText("원문에 미기재");
  await expect(page.getByRole("region", { name: "제작 제약조건" })).toContainText("불명확 · 판독 불가");
  await page.getByText("V03 계정 · 로그인됨", { exact: true }).click();
  await page.screenshot({ path: "test-results/collaboration-detail-mobile.png" });
  await page.getByRole("button", { name: "원본 가이드로 이동 ↓" }).click();
  await expect(page).toHaveURL(new RegExp(`#/collaborations/${ID}$`));
  await expect(page.getByText("합성 원본 가이드입니다.")).toBeVisible();
  api.imageFailure = true;
  await page.getByRole("button", { name: "원본 이미지 보기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("이미지에 접근할 수 없거나");
  api.imageFailure = false;
  await page.getByRole("button", { name: "원본 이미지 다시 불러오기" }).click();
  await expect(page.getByRole("img", { name: "원본 가이드: guide.png" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.getByRole("img").getAttribute("src")).toMatch(/^blob:/);
});
test("dates distinguish not mentioned and uncertain without inventing tasks", async ({ page }) => {
  const data = fixture(); data.v03_contents[0].v03_tasks = [];
  data.v03_sources[0].v03_reviews[0].candidate.information_state = "not_mentioned";
  data.v03_sources[0].v03_reviews[1].candidate.information_state = "uncertain";
  const api = await backend(page, async () => ({ status: 200, body: [data] }));
  await page.goto(route); await api.login();
  const dates = page.getByRole("region", { name: "주요 일정" });
  await expect(dates).toContainText("원문에 미기재"); await expect(dates).toContainText("불명확 · 판독 불가");
  await expect(dates).not.toContainText("2026");
});
test("missing or RLS-hidden collaboration gives the same unavailable state", async ({ page }) => {
  const api = await backend(page, async () => ({ status: 200, body: [] }));
  await page.goto(route); await api.login();
  await expect(page.getByRole("alert")).toContainText("협찬이 없거나 접근 권한이 없어요.");
  await expect(page.getByRole("heading", { name: "주요 일정" })).toHaveCount(0);
});
test("network error retries on the same detail URL", async ({ page }) => {
  let fail = true;
  const api = await backend(page, async () => fail ? { status: 503, body: { message: "private diagnostic" } } : { status: 200, body: [fixture()] });
  await page.goto(route); await api.login();
  await expect(page.getByRole("alert")).toContainText("협찬을 불러오지 못했어요.");
  await expect(page.getByText("private diagnostic")).toHaveCount(0);
  fail = false; await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByRole("heading", { name: "브랜드 A 캠페인", exact: true })).toBeVisible();
});
test("logout hides loaded source and collaboration immediately", async ({ page }) => {
  const api = await backend(page); await page.goto(route); await api.login();
  await expect(page.getByRole("heading", { name: "브랜드 A 캠페인", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByText("협찬을 보려면 위의 V03 계정에서 로그인해주세요.")).toBeVisible();
  await expect(page.getByText("합성 원본 가이드입니다.")).toHaveCount(0);
});
test("malformed URL shows unavailable state without a data query", async ({ page }) => {
  const api = await backend(page); await page.goto("/#/collaborations/invalid");
  await expect(page.getByRole("alert")).toContainText("주소를 확인해주세요."); expect(api.reads).toBe(0);
});
test("loading state appears while the query is pending", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const api = await backend(page, async () => { await pending; return { status: 200, body: [fixture()] }; });
  await page.goto(route); await api.login();
  await expect(page.getByRole("heading", { name: "협찬 불러오는 중" })).toBeVisible();
  release(); await expect(page.getByRole("heading", { name: "브랜드 A 캠페인", exact: true })).toBeVisible();
});
test("a stalled query times out and cannot reveal a late response", async ({ page }) => {
  await page.clock.install();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const api = await backend(page, async () => { await pending; return { status: 200, body: [fixture()] }; });
  await page.goto(route); await api.login();
  await expect(page.getByRole("heading", { name: "협찬 불러오는 중" })).toBeVisible();
  await page.clock.fastForward(15001);
  await expect(page.getByRole("alert")).toContainText("협찬을 불러오지 못했어요.");
  release();
  await expect(page.getByRole("heading", { name: "브랜드 A 캠페인", exact: true })).toHaveCount(0);
});
