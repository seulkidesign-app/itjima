import { test, expect, type Page } from "@playwright/test";
import { phone } from "./helpers";

async function resetKo(page: Page) {
  await page.goto("/app");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("itjima.")) localStorage.removeItem(key);
    }
    localStorage.setItem("itjima_lang", "ko");
    sessionStorage.clear();
  });
  await page.reload();
  await phone(page).getByRole("link", { name: /^(남기기|Capture)$/ }).waitFor();
}

async function submit(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.getByRole("button", { name: /^(남기기|던지기)$/, exact: false }).click();
  await frame
    .locator(
      '[data-testid="left-item-row"], [data-testid="saved-schedule-feedback"], [data-testid="inline-promise"]',
    )
    .last()
    .waitFor({ state: "visible" });
}

test.describe("POST-P0 product quality", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await resetKo(page);
  });

  test("mobile nav has one active plate and generic notes stay quiet", async ({ page }) => {
    const frame = phone(page);
    const captureTab = frame.getByRole("link", { name: /^(남기기|Capture)$/ });
    await expect(captureTab).toHaveAttribute("aria-current", "page");
    const tabBackground = await captureTab.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(tabBackground).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

    await submit(page, "제주도에서 가고 싶은 카페");
    const noteRow = frame
      .getByTestId("left-item-row")
      .filter({ hasText: "제주도에서 가고 싶은 카페" });
    await expect(noteRow).toBeVisible();
    await expect(noteRow.getByTestId("left-item-set-time")).toHaveCount(0);
    // Creation age (방금 / N시간 전) is not schedule metadata on Home.
    await expect(noteRow.getByTestId("left-item-meta")).toHaveCount(0);
  });

  test("Organize summary only claims factual schedule/confirmation/status buckets", async ({ page }) => {
    const frame = phone(page);
    await submit(page, "제주도에서 가고 싶은 카페");
    await submit(page, "내일 오후 3시 치과");

    await frame.getByTestId("open-browse-search").click();
    await expect(frame.getByTestId("records-browse-sheet")).toBeVisible();
    await frame.getByTestId("records-browse-organize").click();

    const organize = page.getByTestId("organize-summary-sheet");
    await expect(organize).toBeVisible();
    await expect(organize.getByTestId("organize-tile-schedule")).toContainText("일정");
    await expect(organize.getByTestId("organize-tile-confirm")).toContainText("확인 필요");
    await expect(organize.getByTestId("organize-tile-done")).toContainText("완료");
    await expect(organize.getByTestId("organize-tile-all")).toContainText("전체");
    await expect(organize.getByText("할 일", { exact: true })).toHaveCount(0);
    await expect(organize.getByText("날짜 없음", { exact: true })).toHaveCount(0);
  });

  test("schedule is unified and row completion stays accessible", async ({ page }) => {
    const frame = phone(page);
    await submit(page, "내일 오후 3시 치과");

    await frame.getByRole("link", { name: /^(일정|Schedule)$/ }).click();
    await expect(frame.getByRole("heading", { name: "내 일정" })).toBeVisible();
    await expect(frame.getByTestId("schedule-section-today")).toBeVisible();
    await expect(frame.getByTestId("schedule-section-upcoming")).toBeVisible();
    await expect(frame.getByRole("tab")).toHaveCount(0);

    const row = frame.getByTestId("schedule-compact-row").filter({ hasText: "치과" });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("schedule-row-edit")).toHaveCount(0);

    const complete = row.getByTestId("schedule-row-complete");
    await expect(complete).toBeVisible();
    const ringSize = await complete.locator("span").first().evaluate((el) => ({
      width: getComputedStyle(el).width,
      height: getComputedStyle(el).height,
    }));
    expect(ringSize.width).toBe("22px");
    expect(ringSize.height).toBe("22px");

    await row.getByTestId("schedule-row-open-detail").click();
    await expect(page.getByTestId("thought-detail-sheet")).toBeVisible();
  });
});