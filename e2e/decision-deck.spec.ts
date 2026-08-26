import { test, expect } from "@playwright/test";
import {
  resetAppState,
  addThought,
  phone,
  dismissInlinePromise,
  closeDecisionDeckIfOpen,
  assertDecisionDeckUnreachableFromMenu,
} from "./helpers";
import {
  resolveDragOutcome,
  previewDragOutcome,
  shouldCommitDrag,
} from "../src/lib/decision";

/**
 * M2: DecisionDeck product entry is removed from V0.2.
 * Keep pure decision helpers covered; UI archive/today flows live in legacy code only.
 */
test.describe("Decision deck swipe", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.evaluate(() =>
      localStorage.setItem("itjima.swipe.tutorial.done", "1"),
    );
  });

  test("threshold helper matches new direction model", () => {
    const w = 320;
    const h = 360;
    expect(resolveDragOutcome(110, 0, w, h, "horizontal")).toBe("today");
    expect(resolveDragOutcome(-110, 0, w, h, "horizontal")).toBe("archive");
    expect(resolveDragOutcome(0, 100, w, h, "vertical")).toBe("later");
    expect(previewDragOutcome(110, 0, w, h, "horizontal")).toBe("today");
    expect(previewDragOutcome(-110, 0, w, h, "horizontal")).toBe("archive");
    expect(previewDragOutcome(0, 100, w, h, "vertical")).toBe("later");
    expect(shouldCommitDrag(110, 0, 0, 0, w, h, "horizontal")).toBe("today");
  });

  test("V0.2 UI cannot open one-by-one DecisionDeck from Capture menu", async ({
    page,
  }) => {
    await addThought(page, `No deck ${Date.now()}`);
    await dismissInlinePromise(page);
    await closeDecisionDeckIfOpen(page);
    await assertDecisionDeckUnreachableFromMenu(page);
    await expect(
      phone(page).getByRole("dialog", { name: /One by one|하나씩/ }),
    ).toHaveCount(0);
  });
});
