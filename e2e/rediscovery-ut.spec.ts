import { test, expect } from "@playwright/test";

test.describe("Rediscovery UT boundary", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { dataLayer?: unknown[] }).dataLayer = [];
    });
  });

  test("experimental surface stays locked when REDISCOVERY is off", async ({ page }) => {
    await page.goto("/rediscovery");
    await expect(page.getByTestId("rediscovery-locked")).toBeVisible();
    await expect(page.getByRole("button", { name: "보기" })).toHaveCount(0);
  });

  test("enabled UT records impression and open without record content", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("itjima.")) localStorage.removeItem(key);
      }
      localStorage.setItem("itjima_lang", "ko");
      localStorage.setItem(
        "itjima.__feature_overrides__",
        JSON.stringify({ REDISCOVERY: true }),
      );
      localStorage.setItem(
        "itjima.guest.archive",
        JSON.stringify([
          {
            id: "ut-private-memory-id",
            text: "UT에서만 보이는 민감한 여행 메모",
            raw_text: "원문 UT에서만 보이는 민감한 여행 메모",
            images: [],
            created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
          },
        ]),
      );
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

    await page.getByRole("button", { name: "보기" }).click();
    await expect(page).toHaveURL(/\/archive/);

    const openEvents = await page.evaluate(() =>
      ((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [])
        .filter((event) => event.event === "rediscovery_open"),
    );
    expect(openEvents).toHaveLength(1);
    expect(JSON.stringify(openEvents)).not.toContain("ut-private-memory-id");
    expect(JSON.stringify(openEvents)).not.toContain("민감한 여행 메모");
  });

  test("done and hide remain separately measurable intents", async ({ page }) => {
    const seed = async () => {
      await page.goto("/");
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem("itjima_lang", "ko");
        localStorage.setItem(
          "itjima.__feature_overrides__",
          JSON.stringify({ REDISCOVERY: true }),
        );
        localStorage.setItem(
          "itjima.guest.archive",
          JSON.stringify([
            {
              id: "ut-action-memory",
              text: "다시 생각할 메모",
              images: [],
              created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
            },
          ]),
        );
      });
      await page.goto("/rediscovery");
    };

    await seed();
    await page.getByRole("button", { name: "완료했어요" }).click();
    let events = await page.evaluate(() =>
      ((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [])
        .filter((event) => event.event === "rediscovery_done"),
    );
    expect(events).toHaveLength(1);

    await seed();
    await page.getByRole("button", { name: "다시 보지 않기" }).click();
    events = await page.evaluate(() =>
      ((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [])
        .filter((event) => event.event === "rediscovery_hide"),
    );
    expect(events).toHaveLength(1);
  });
});
