import { expect, test } from "@playwright/test";
import {
  addThought,
  assertDecisionDeckUnreachableFromMenu,
  phone,
  resetAppState,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetAppState(page);
  await page.evaluate(() =>
    localStorage.setItem("itjima.swipe.tutorial.done", "1"),
  );
});

test("home keeps the quiet background and stages the newest thought", async ({ page }) => {
  await addThought(page, `Motion thought ${Date.now()}`);

  const lane = phone(page).locator(".home-chat-lane");
  await expect(lane).toBeVisible();
  const backgroundImage = await lane.evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  );
  expect(backgroundImage).toBe("none");

  const newestTurn = phone(page).locator(
    '[data-testid="left-item-row"][data-newest="true"]',
  );
  await expect(newestTurn).toHaveCount(1);
  await expect(newestTurn).toBeVisible();
  // List rows stay calm — no chat-bubble entrance animation.
  const animationName = await newestTurn.evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  expect(animationName === "none" || animationName === "").toBeTruthy();
});

test("DecisionDeck drag surface is unreachable from Capture (M2)", async ({
  page,
}) => {
  await addThought(page, `Directional card ${Date.now()}`);
  await assertDecisionDeckUnreachableFromMenu(page);
  await expect(
    phone(page).getByTestId("decision-deck-active-card"),
  ).toHaveCount(0);
});

test("reduced motion removes the interaction animations", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await resetAppState(page);
  await addThought(page, `Reduced motion ${Date.now()}`);

  const row = phone(page).locator(
    '[data-testid="left-item-row"][data-newest="true"]',
  );
  await expect(row).toBeVisible();
  const animationName = await row.evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  expect(animationName === "none" || animationName === "").toBeTruthy();

  await context.close();
});
