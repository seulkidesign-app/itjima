import { test, expect } from "@playwright/test";

test.describe("v1 release boundary", () => {
  test("capture saves the original thought without invoking server AI", async ({ page }) => {
    let aiRequestCount = 0;

    await page.route("**/api/brain-mirror", async (route) => {
      aiRequestCount += 1;
      await route.abort();
    });

    // A stale browser override must not be able to reactivate v1-locked AI UI.
    await page.addInitScript(() => {
      localStorage.setItem(
        "itjima.__feature_overrides__",
        JSON.stringify({
          BRAIN_MIRROR: true,
          INLINE_PROMISE: true,
          ARCHIVE_AI_GROUPING: true,
        }),
      );
    });

    await page.goto("/app");

    const input = page.locator("#capture-input");
    await expect(input).toBeVisible();
    await input.fill("내일 오후 3시 치과");

    const submit = page.locator('form.composer-hero button[type="submit"]');
    await expect(submit).toBeEnabled();
    await submit.click();

    await page.waitForTimeout(500);

    expect(aiRequestCount).toBe(0);
    // V02-08C: clear timed capture auto-commits — no AI, no second save CTA.
    await expect(page.getByTestId("saved-schedule-feedback")).toBeVisible();
    await expect(page.getByTestId("commitment-confirm")).toHaveCount(0);
    await expect(page.getByTestId("promise-primary")).toHaveCount(0);
    await expect(page.getByText(/AI가 이해했어요|AI understood/i)).toHaveCount(0);
  });
});
