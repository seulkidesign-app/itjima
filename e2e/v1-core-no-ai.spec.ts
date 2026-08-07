import { test, expect } from "@playwright/test";

test.describe("v1 release boundary", () => {
  test("capture saves the original thought and builds a real local commitment without server AI", async ({
    page,
  }) => {
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

    const capturedTurn = page.getByTestId("chat-turn").last();
    await expect(
      capturedTurn
        .getByRole("paragraph")
        .filter({ hasText: /^내일 오후 3시 치과$/ })
        .first(),
    ).toBeVisible();

    const commitment = capturedTurn.getByTestId("schedule-commitment-card");
    await expect(commitment).toBeVisible();
    await expect(commitment.getByTestId("commitment-title")).toHaveText("치과");
    await expect(commitment.getByTestId("commitment-time")).toContainText("3:00");
    await expect(commitment).toHaveAttribute("data-reminder", "0");

    expect(aiRequestCount).toBe(0);
    await expect(page.getByText(/AI가 이해했어요|AI understood/i)).toHaveCount(0);
  });
});
