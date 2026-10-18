import { expect, test } from "@playwright/test";
import { backend, fixture, ID } from "./detail-fixture";
function homeFixture() {
  const active = fixture();
  active.v03_contents[0].v03_tasks[0].due_date = "2026-10-10";
  active.v03_contents[0].v03_tasks.push({ id: "done", title: "완료한 작업", type: "custom", due_date: "2026-10-01", revision: 0, completed_at: "2026-10-02T00:00:00Z" });
  const undated = fixture(); undated.id = "88888888-8888-4888-8888-888888888888"; undated.title = "날짜 없는 협찬";
  undated.v03_contents[0].v03_tasks = [];
  undated.v03_sources[0].v03_reviews[0].candidate.information_state = "not_mentioned";
  undated.v03_sources[0].v03_reviews[1].candidate.information_state = "uncertain";
  const held = fixture(); held.id = "99999999-9999-4999-8999-999999999999"; held.title = "보류 캠페인"; held.status = "on_hold";
  held.v03_contents[0].v03_tasks = [{ id: "held-task", title: "보류 중 남은 작업", type: "custom", due_date: "2026-10-09", revision: 0, completed_at: null }];
  const done = fixture(); done.id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; done.title = "완료 캠페인"; done.status = "completed";
  done.v03_contents[0].v03_tasks = [{ id: "completed-task", title: "완료 상태의 미완료 작업", type: "custom", due_date: null, revision: 0, completed_at: null }];
  return [active, undated, held, done];
}
test("signed-out home does not read user data and retains brief entry", async ({ page }) => {
  const api = await backend(page);
  await page.goto("/#/");
  await expect(page.getByText("위의 V03 계정에서 로그인하면 내 협찬과 할 일을 볼 수 있어요.")).toBeVisible();
  expect(api.reads).toBe(0);
  await page.getByRole("link", { name: "브리프 가져오기 ＋", exact: true }).click();
  await expect(page.getByLabel("브리프 텍스트")).toBeVisible();
});
test("mobile home separates statuses and keeps overdue, uncertain and undated items", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-15T03:00:00Z") });
  const api = await backend(page, async () => ({ status: 200, body: [fixture()] }), async () => ({ status: 200, body: homeFixture() }));
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/#/"); await api.login();
  const active = page.getByRole("region", { name: "진행 중인 협찬" });
  await expect(active).toContainText("브랜드 A 캠페인"); await expect(active).toContainText("날짜 없는 협찬");
  await expect(active).toContainText("원문에 미기재"); await expect(active).toContainText("불명확 · 판독 불가");
  await expect(active).not.toContainText("보류 캠페인"); await expect(active).not.toContainText("완료 캠페인");
  const next = page.getByRole("region", { name: "다음 해야 할 일" });
  await expect(next).toContainText("기한 지남 · 미완료"); await expect(next).toContainText("기한 없음");
  await expect(next.getByRole("link")).toHaveCount(3);
  await expect(next.getByRole("link").first()).toContainText("가편 전달");
  await expect(page.getByText("완료한 작업", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "보류한 협찬" })).toContainText("보류 중 남은 작업");
  await expect(page.getByRole("region", { name: "보류한 협찬" })).toContainText("기한 지남 · 미완료");
  await expect(page.getByRole("region", { name: "완료한 협찬" })).toContainText("완료 상태의 미완료 작업");
  await expect(page.getByText("광고 코드", { exact: true })).toHaveCount(0);
  await page.getByText("V03 계정 · 로그인됨", { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/home-mobile.png" });
  await page.getByRole("button", { name: "진행 중 2건 ↓", exact: true }).click();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("active-title");
  const reads = api.reads; await page.reload();
  await expect(page.getByRole("region", { name: "진행 중인 협찬" })).toContainText("브랜드 A 캠페인");
  expect(api.reads).toBeGreaterThan(reads);
  await page.getByRole("link", { name: "브랜드 A 캠페인 상세 보기", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/collaborations/${ID}$`));
  await expect(page.getByRole("heading", { name: "브랜드 A 캠페인", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "← 홈", exact: true }).click();
  await expect(page.getByRole("region", { name: "진행 중인 협찬" })).toContainText("날짜 없는 협찬");
});
test("empty owner list offers a first brief without inventing sample campaigns", async ({ page }) => {
  const api = await backend(page, async () => ({ status: 200, body: [] }));
  await page.goto("/#/"); await api.login();
  await expect(page.getByRole("heading", { name: "아직 등록된 협찬이 없어요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "브리프 가져오기 ＋", exact: true })).toBeVisible();
});
test("only held or completed collaborations do not appear active or become an empty database", async ({ page }) => {
  const api = await backend(page, async () => ({ status: 200, body: homeFixture().slice(2) }));
  await page.goto("/#/"); await api.login();
  await expect(page.getByRole("region", { name: "진행 중인 협찬" })).toContainText("진행 중인 협찬이 없어요.");
  await expect(page.getByRole("region", { name: "완료한 협찬" })).toContainText("완료 캠페인");
  await expect(page.getByRole("heading", { name: "아직 등록된 협찬이 없어요" })).toHaveCount(0);
});
test("home error can retry without showing private backend diagnostics", async ({ page }) => {
  let fail = true;
  const api = await backend(page, async () => fail ? { status: 503, body: { message: "private diagnostic" } } : { status: 200, body: homeFixture() });
  await page.goto("/#/"); await api.login();
  await expect(page.getByRole("alert")).toContainText("협찬 목록을 불러오지 못했어요.");
  await expect(page.getByText("private diagnostic")).toHaveCount(0);
  fail = false; await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByRole("region", { name: "진행 중인 협찬" })).toContainText("날짜 없는 협찬");
});
test("logout removes fetched home data", async ({ page }) => {
  const api = await backend(page, async () => ({ status: 200, body: homeFixture() }));
  await page.goto("/#/"); await api.login();
  await expect(page.getByRole("region", { name: "진행 중인 협찬" })).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByText("위의 V03 계정에서 로그인하면 내 협찬과 할 일을 볼 수 있어요.")).toBeVisible();
  await expect(page.getByText("날짜 없는 협찬", { exact: true })).toHaveCount(0);
});
test("loading home times out instead of becoming a misleading empty list", async ({ page }) => {
  await page.clock.install();
  let release!: () => void; const pending = new Promise<void>((resolve) => { release = resolve; });
  const api = await backend(page, async () => { await pending; return { status: 200, body: homeFixture() }; });
  await page.goto("/#/"); await api.login();
  await expect(page.getByRole("heading", { name: "협찬 불러오는 중" })).toBeVisible();
  await page.clock.fastForward(15001);
  await expect(page.getByRole("alert")).toContainText("협찬 목록을 불러오지 못했어요.");
  release();
  await expect(page.getByRole("region", { name: "진행 중인 협찬" })).toHaveCount(0);
});
test("a response arriving after signout cannot restore private home data", async ({ page }) => {
  let release!: () => void; const pending = new Promise<void>((resolve) => { release = resolve; });
  const api = await backend(page, async () => { await pending; return { status: 200, body: homeFixture() }; });
  await page.goto("/#/"); await api.login();
  await expect(page.getByRole("heading", { name: "협찬 불러오는 중" })).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click(); release();
  await expect(page.getByText("위의 V03 계정에서 로그인하면 내 협찬과 할 일을 볼 수 있어요.")).toBeVisible();
  await expect(page.getByRole("region", { name: "진행 중인 협찬" })).toHaveCount(0);
});
