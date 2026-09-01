import { test, expect } from "@playwright/test";

const DAY = 86400000;

async function seedStudy(
  page: import("@playwright/test").Page,
  opts?: { returnGapDays?: number },
) {
  await page.goto("/");
  await page.evaluate(
    ({ returnGapDays }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("itjima_lang", "ko");
      localStorage.setItem(
        "itjima.__feature_overrides__",
        JSON.stringify({ REDISCOVERY: true }),
      );
      localStorage.setItem(
        "itjima.guest.inbox",
        JSON.stringify([
          {
            id: "longitudinal-private-record",
            text: "사용자에게만 보여야 하는 오래된 메모",
            raw_text: "사용자에게만 보여야 하는 오래된 메모",
            images: [],
            status: "active",
            temporal_state: "no_time",
            created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
          },
        ]),
      );
      localStorage.setItem("itjima.guest.archive", JSON.stringify([]));
      localStorage.setItem("itjima.guest.schedules", JSON.stringify([]));

      if (returnGapDays !== undefined) {
        const prior = Date.now() - returnGapDays * 86400000;
        localStorage.setItem(
          "itjima.rediscovery.study.first_visit_at",
          String(prior - 86400000),
        );
        localStorage.setItem(
          "itjima.rediscovery.study.last_visit_at",
          String(prior),
        );
      }
    },
    { returnGapDays: opts?.returnGapDays },
  );
}

test.describe("Rediscovery longitudinal UT", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { dataLayer?: unknown[] }).dataLayer = [];
    });
  });

  test("first study visit stays in normal Capture even when an old candidate exists", async ({ page }) => {
    await seedStudy(page);
    await page.goto("/app");

    await expect(page).toHaveURL(/\/app$/);

    const sessionEvents = await page.evaluate(() =>
      ((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [])
        .filter((event) => event.event === "rediscovery_session_start"),
    );
    expect(sessionEvents).toHaveLength(1);
    expect(sessionEvents[0]?.return_gap_bucket).toBe("first");
    expect(JSON.stringify(sessionEvents)).not.toContain("longitudinal-private-record");
    expect(JSON.stringify(sessionEvents)).not.toContain("오래된 메모");
  });

  test("a later unprompted return auto-enters Rediscovery once and records timing only", async ({ page }) => {
    await seedStudy(page, { returnGapDays: 4 });
    await page.goto("/app");

    await expect(page).toHaveURL(/\/rediscovery$/);
    await expect(
      page.getByRole("heading", { name: "사용자에게만 보여야 하는 오래된 메모" }),
    ).toBeVisible();

    const sessionEvents = await page.evaluate(() =>
      ((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [])
        .filter((event) => event.event === "rediscovery_session_start"),
    );
    expect(sessionEvents).toHaveLength(1);
    expect(sessionEvents[0]?.return_gap_bucket).toBe("3_6d");
    expect(sessionEvents[0]?.study_age_bucket).toBe("day_3_6");
    expect(JSON.stringify(sessionEvents)).not.toContain("longitudinal-private-record");
    expect(JSON.stringify(sessionEvents)).not.toContain("오래된 메모");

    const impressions = await page.evaluate(() =>
      ((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [])
        .filter((event) => event.event === "rediscovery_impression"),
    );
    expect(impressions).toHaveLength(1);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/app$/);

    const sessionEventsAfterBack = await page.evaluate(() =>
      ((window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer ?? [])
        .filter((event) => event.event === "rediscovery_session_start"),
    );
    expect(sessionEventsAfterBack).toHaveLength(1);
  });
});
