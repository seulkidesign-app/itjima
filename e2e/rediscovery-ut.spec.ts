import { test, expect } from "@playwright/test";

async function enableRediscovery(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("itjima_lang", "ko");
    localStorage.setItem(
      "itjima.__feature_overrides__",
      JSON.stringify({ REDISCOVERY: true }),
    );
  });
}

test.describe("Rediscovery UT boundary", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { dataLayer?: unknown[] }).dataLayer = [];
    });
  });

  test("experimental surface stays locked when REDISCOVERY is off", async ({ page }) => {
    await page.goto("/rediscovery");
    await expect(page.getByTestId("rediscovery-locked")).toBeVisible();
    await expect(page.getByRole("button", { name: "기록 보기" })).toHaveCount(0);
  });

  test("normal Capture record can resurface without being archived first", async ({ page }) => {
    await enableRediscovery(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "itjima.guest.inbox",
        JSON.stringify([
          {
            id: "ut-canonical-record",
            text: "언젠가 제주에서 한 달 살아보기",
            raw_text: "언젠가 제주에서 한 달 살아보기",
            images: [],
            status: "active",
            temporal_state: "no_time",
            created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
          },
        ]),
      );
      localStorage.setItem("itjima.guest.archive", JSON.stringify([]));
      localStorage.setItem("itjima.guest.schedules", JSON.stringify([]));
    });

    await page.goto("/rediscovery");
    await expect(page.getByText("언젠가 제주에서 한 달 살아보기", { exact: true })).toBeVisible();
    await expect(page.getByText(/남긴 기록/)).toBeVisible();
  });

  test("enabled UT records impression and in-place open without record content in analytics", async ({ page }) => {
    await enableRediscovery(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "itjima.guest.inbox",
        JSON.stringify([
          {
            id: "ut-private-memory-id",
            text: "UT에서만 보이는 민감한 여행 메모",
            raw_text: "원문 UT에서만 보이는 민감한 여행 메모\n두 번째 줄도 외부 화면으로 보내지 않아요",
            images: [],
            status: "active",
            temporal_state: "no_time",
            created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
          },
        ]),
      );
      localStorage.setItem("itjima.guest.archive", JSON.stringify([]));
      localStorage.setItem("itjima.guest.schedules", JSON.stringify([]));
    });

    await page.goto("/rediscovery");
    await expect(page.getByText("UT에서만 보이는 민감한 여행 메모", { exact: true })).toBeVisible();

    const impressionEvents = await page.evaluate(() =>
      ((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [])
        .filter((event) => event.event === "rediscovery_impression"),
    );
    expect(impressionEvents).toHaveLength(1);
    expect(JSON.stringify(impressionEvents)).not.toContain("ut-private-memory-id");
    expect(JSON.stringify(impressionEvents)).not.toContain("민감한 여행 메모");

    await page.getByRole("button", { name: "기록 보기" }).click();
    await expect(page).toHaveURL(/\/rediscovery$/);
    await expect(page.getByTestId("rediscovery-record-text")).toContainText("두 번째 줄도");

    const openEvents = await page.evaluate(() =>
      ((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [])
        .filter((event) => event.event === "rediscovery_open"),
    );
    expect(openEvents).toHaveLength(1);
    expect(JSON.stringify(openEvents)).not.toContain("ut-private-memory-id");
    expect(JSON.stringify(openEvents)).not.toContain("민감한 여행 메모");
  });

  test("later snoozes instead of permanently dismissing the record", async ({ page }) => {
    await enableRediscovery(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "itjima.guest.inbox",
        JSON.stringify([
          {
            id: "ut-later-record",
            text: "다음에 다시 생각할 메모",
            images: [],
            status: "active",
            created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
          },
        ]),
      );
    });

    await page.goto("/rediscovery");
    await page.getByRole("button", { name: "나중에 다시" }).click();
    const events = await page.evaluate(() =>
      ((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [])
        .filter((event) => event.event === "rediscovery_later"),
    );
    expect(events).toHaveLength(1);

    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(page.getByText("다음에 다시 생각할 메모", { exact: true })).toHaveCount(0);
    await expect(page.getByText("지금은 다시 볼 기록이 없어요")).toBeVisible();
  });

  test("same record does not immediately resurface again in one session", async ({ page }) => {
    await enableRediscovery(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "itjima.guest.inbox",
        JSON.stringify([
          {
            id: "ut-session-record",
            text: "세션에서 한 번만 볼 기록",
            images: [],
            status: "active",
            created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
          },
        ]),
      );
    });

    await page.goto("/rediscovery");
    await expect(page.getByText("세션에서 한 번만 볼 기록", { exact: true })).toBeVisible();
    await page.goto("/");
    await page.goto("/rediscovery");
    await expect(page.getByText("세션에서 한 번만 볼 기록", { exact: true })).toHaveCount(0);
  });

  test("hide permanently removes the surfaced record from Rediscovery selection", async ({ page }) => {
    await enableRediscovery(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "itjima.guest.inbox",
        JSON.stringify([
          {
            id: "ut-hide-record",
            text: "그만 볼 메모",
            images: [],
            status: "active",
            created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
          },
        ]),
      );
    });

    await page.goto("/rediscovery");
    await page.getByRole("button", { name: "그만 보기" }).click();
    const events = await page.evaluate(() =>
      ((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [])
        .filter((event) => event.event === "rediscovery_hide"),
    );
    expect(events).toHaveLength(1);

    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(page.getByText("그만 볼 메모", { exact: true })).toHaveCount(0);
  });
});
