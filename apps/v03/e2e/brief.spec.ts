import { test, expect } from "@playwright/test";
import { openReview, confirmAll } from "./helpers";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ioAAAAASUVORK5CYII=",
  "base64",
);
test("text, original preview and mock groups do not write final data", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(r.method()))
      writes.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("link", {name:"협찬 관리 시작하기",exact:true}).first().click();
  await page.evaluate(() => localStorage.setItem("v02-sentinel", "unchanged"));
  await page.getByRole("link", { name: "브리프 가져오기" }).click();
  await page.getByRole("button", {name:"샘플 체험 · 저장 안 됨",exact:true}).click();
  const text = "  브랜드 B\n가편 11월 5일 / 업로드 11월 10일\n영상 필수";
  await page.getByLabel("브리프 텍스트").fill(text);
  await page.getByRole("button", { name: "원본 미리보기" }).click();
  await expect(page.locator(".source-text")).toHaveText(text.trim());
  await page.getByRole("button", { name: "Mock 결과 보기" }).click();
  for (const name of ["일정", "해야 할 일", "제작 제약조건"])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(page.getByText("지금은 샘플 결과예요")).toBeVisible();
  await expect(page.getByTestId("creation-payload")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "샘플 요약 보기", exact: true }),
  ).toBeDisabled();
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({
    "v02-sentinel": "unchanged",
  });
  await page.getByRole("button", { name: "원본 수정하기" }).click();
  await expect(page.getByLabel("브리프 텍스트")).toHaveValue(text);
});
test("image-only preview and mock review", async ({ page }) => {
  await page.goto("/#/brief/new");
  await page.getByRole("button", {name:"샘플 체험 · 저장 안 됨",exact:true}).click();
  await page
    .getByLabel("이미지 선택", { exact: true })
    .setInputFiles({ name: "guide.png", mimeType: "image/png", buffer: png });
  await expect(
    page.getByRole("img", { name: "선택한 스크린샷 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "원본 미리보기" }).click();
  await expect(
    page.getByRole("img", { name: "원본 스크린샷 1: guide.png" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mock 결과 보기" }).click();
  await expect(
    page.getByRole("heading", { name: "제작 제약조건" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "원본 스크린샷 1: guide.png" }),
  ).toBeVisible();
});
test("empty input and removed screenshots cannot proceed", async ({ page }) => {
  await page.goto("/#/brief/new");
  await page.getByRole("button", {name:"샘플 체험 · 저장 안 됨",exact:true}).click();
  await page.getByLabel("브리프 텍스트").fill("   ");
  await expect(
    page.getByRole("button", { name: "원본 미리보기" }),
  ).toBeDisabled();
  await page
    .getByLabel("이미지 선택", { exact: true })
    .setInputFiles({ name: "guide.png", mimeType: "image/png", buffer: png });
  await expect(
    page.getByRole("button", { name: "원본 미리보기" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "guide.png 삭제" }).click();
  await expect(
    page.getByRole("button", { name: "원본 미리보기" }),
  ).toBeDisabled();
});
test("corrupted screenshot is rejected", async ({ page }) => {
  await page.goto("/#/brief/new");
  await page.getByRole("button", {name:"샘플 체험 · 저장 안 됨",exact:true}).click();
  await page
    .getByLabel("이미지 선택", { exact: true })
    .setInputFiles({
      name: "bad.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
  await expect(page.getByRole("alert")).toContainText("이미지를 열 수 없어요");
  await expect(page.getByRole("img")).toHaveCount(0);
});
test("direct review and refresh restore no final records", async ({ page }) => {
  await page.goto("/#/brief/review");
  await expect(page).toHaveURL(/#\/brief\/new$/);
  await openReview(page);
  await page.reload();
  await expect(page).toHaveURL(/#\/brief\/new$/);
  await expect(page.getByLabel("브리프 텍스트")).toHaveValue("");
});
test("browser back and typing preserve source on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/#/brief/new");
  await page.getByRole("button", {name:"샘플 체험 · 저장 안 됨",exact:true}).click();
  await page.getByLabel("브리프 텍스트").fill("");
  await page
    .getByLabel("브리프 텍스트")
    .pressSequentially("협찬 원본 입력", { delay: 20 });
  await expect(page.getByLabel("브리프 텍스트")).toHaveValue("협찬 원본 입력");
  await page.getByRole("button", { name: "원본 미리보기" }).click();
  await page.goBack();
  await expect(page.getByLabel("브리프 텍스트")).toHaveValue("협찬 원본 입력");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("independent dates and user edits gate explicit local payload creation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openReview(page);
  await expect(
    page.getByRole("button", { name: "샘플 요약 보기", exact: true }),
  ).toBeDisabled();
  const first = page.getByTestId("candidate-draft_due");
  await expect(
    first.getByRole("button", { name: "이 후보 확인" }),
  ).toBeDisabled();
  await first.getByLabel("확정할 날짜 (연도 포함)").fill("2026-10-20");
  await first.getByRole("button", { name: "이 후보 확인" }).click();
  await expect(first.getByText("사용자 수정", { exact: true })).toBeVisible();
  await expect(
    page
      .getByTestId("candidate-publish_due")
      .getByText("미확인", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "원본 수정하기" }).click();
  await page.getByRole("button", { name: "원본 미리보기" }).click();
  await page.getByRole("button", { name: "Mock 결과 보기" }).click();
  await page.getByLabel("협찬 이름").fill("브랜드 A 캠페인");
  const film = page.getByTestId("candidate-film");
  await film.getByLabel("검토할 값").fill("영상 2편 촬영");
  await confirmAll(page);
  await expect(film.getByText("사용자 수정", { exact: true })).toBeVisible();
  await expect(
    page
      .getByTestId("candidate-captions")
      .getByText("사용자 확인", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("creation-payload")).toHaveCount(0);
  await page
    .getByRole("button", { name: "샘플 요약 보기", exact: true })
    .click();
  const payload = JSON.parse(
    await page.getByTestId("creation-payload").innerText(),
  );
  expect(payload.collaboration.title).toBe("브랜드 A 캠페인");
  expect(
    payload.tasks
      .filter((t: { due_date: string | null }) => t.due_date)
      .map((t: { due_date: string }) => t.due_date),
  ).toEqual(["2026-10-20", "2026-10-23"]);
  expect(
    payload.constraints.find((c: { type: string }) => c.type === "usage_rights")
      .value,
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  await film.getByLabel("검토할 값").fill("영상 3편 촬영");
  await expect(film.getByText("미확인", { exact: true })).toBeVisible();
  await expect(page.getByTestId("creation-payload")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "샘플 요약 보기", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("uncertain date does not generate an exact scheduled task", async ({
  page,
}) => {
  await openReview(page);
  await confirmAll(page);
  const card = page.getByTestId("candidate-draft_due");
  await card.getByLabel("정보 상태").selectOption("uncertain");
  await card.getByRole("button", { name: "이 후보 확인" }).click();
  await page
    .getByRole("button", { name: "샘플 요약 보기", exact: true })
    .click();
  const p = JSON.parse(await page.getByTestId("creation-payload").innerText());
  expect(
    p.tasks.some(
      (t: { candidate_id: string }) => t.candidate_id === "draft_due",
    ),
  ).toBe(false);
  expect(p.review[0]).toMatchObject({
    information_state: "uncertain",
    value: null,
    due_date: null,
  });
});
