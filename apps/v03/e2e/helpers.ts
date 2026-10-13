import type { Page } from "@playwright/test";
export async function openReview(page: Page) {
  await page.goto("/#/brief/new");
  await page.getByRole("button", { name: "예시 넣기" }).click();
  await page.getByRole("button", { name: "원본 미리보기" }).click();
  await page.getByRole("button", { name: "Mock 결과 보기" }).click();
  await page.getByLabel("협찬 이름").fill("브랜드 A 캠페인");
}
export async function confirmAll(page: Page) {
  for (const [id, date] of [
    ["draft_due", "2026-10-20"],
    ["publish_due", "2026-10-23"],
  ]) {
    const card = page.getByTestId(`candidate-${id}`);
    await card.getByLabel("확정할 날짜 (연도 포함)").fill(date);
    await card.getByRole("button", { name: "이 후보 확인" }).click();
  }
  for (const id of [
    "film",
    "captions",
    "approval",
    "thumbnail",
    "platform",
    "retention",
  ])
    await page
      .getByTestId(`candidate-${id}`)
      .getByRole("button", { name: "이 후보 확인" })
      .click();
  const rights = page.getByTestId("candidate-usage_rights");
  await rights.getByLabel("정보 상태").selectOption("not_mentioned");
  await rights.getByRole("button", { name: "이 후보 확인" }).click();
}
