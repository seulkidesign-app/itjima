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

    await page.goto("/");

    const input = page.locator("#capture-input");
    await expect(input).toBeVisible();
    await input.fill("내일 오후 3시 치과");

    const submit = page.locator('form.composer-hero button[type="submit"]');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText("내일 오후 3시 치과", { exact: true })).toBeVisible();
    await page.waitForTimeout(500);

    expect(aiRequestCount).toBe(0);
    const localInterpretation = page.locator('[data-testid="inline-promise"]');
    await expect(localInterpretation).toHaveCount(1);
    await expect(localInterpretation).toHaveAttribute(
      "data-intent",
      "schedule_exact",
    );
    await expect(page.getByText(/AI가 이해했어요|AI understood/i)).toHaveCount(0);
  });
});
