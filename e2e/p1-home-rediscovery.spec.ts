import { test, expect, type Page } from "@playwright/test";
import { GUEST_INBOX_KEY, phone, resetAppState } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

async function seedHomeRecords(page: Page) {
  await page.evaluate(
    ({ key, day }) => {
      const now = Date.now();
      const row = (id: string, text: string, ageDays: number) => ({
        id,
        text,
        raw_text: text,
        images: [],
        created_at: new Date(now - ageDays * day).toISOString(),
        status: "active",
        temporal_state: "no_time",
        clarification_state: null,
        start_time: null,
        end_time: null,
        structured_at: null,
      });
      localStorage.setItem(
        key,
        JSON.stringify([
          row("recent-1", "최근 기록 하나", 0.2),
          row("recent-2", "최근 기록 둘", 0.6),
          row("recent-3", "최근 기록 셋", 1.2),
          row("rediscover-me", "서울숲 근처 가보고 싶은 카페", 4.2),
        ]),
      );
    },
    { key: GUEST_INBOX_KEY, day: DAY },
  );
  await page.reload();
  await phone(page).getByTestId("left-items-section").waitFor({ state: "visible" });
}

test.describe("P1 Home rediscovery", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("quietly resurfaces one older record without duplicating the recent three", async ({ page }) => {
    await seedHomeRecords(page);

    const frame = phone(page);
    const card = frame.getByTestId("home-rediscovery-card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("서울숲 근처 가보고 싶은 카페");
    await expect(card).toContainText(/Brought this back|다시 꺼내봤어요/);

    const recentSection = frame.getByTestId("left-items-section");
    await expect(recentSection).toContainText("최근 기록 하나");
    await expect(recentSection).toContainText("최근 기록 둘");
    await expect(recentSection).toContainText("최근 기록 셋");
    await expect(recentSection).not.toContainText("서울숲 근처 가보고 싶은 카페");
  });

  test("Keep here hides the card and prevents immediate resurfacing after reload", async ({ page }) => {
    await seedHomeRecords(page);

    const frame = phone(page);
    await frame.getByTestId("home-rediscovery-keep").click();
    await expect(frame.getByTestId("home-rediscovery-card")).toHaveCount(0);

    await page.reload();
    await expect(frame.getByTestId("home-rediscovery-card")).toHaveCount(0);
  });

  test("opening a resurfaced record uses the existing record detail instead of a new inbox", async ({ page }) => {
    await seedHomeRecords(page);

    const frame = phone(page);
    await frame.getByTestId("home-rediscovery-open").click();
    await expect(frame.getByTestId("home-rediscovery-card")).toHaveCount(0);
    await expect(page.getByRole("dialog").last()).toContainText(
      "서울숲 근처 가보고 싶은 카페",
    );
  });
});
