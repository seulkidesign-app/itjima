import { expect, test } from "@playwright/test";
import {
  addThought,
  closeDecisionDeckIfOpen,
  dismissInlinePromise,
  phone,
  resetAppState,
} from "./helpers";

async function openDeck(page: import("@playwright/test").Page) {
  await dismissInlinePromise(page);
  await closeDecisionDeckIfOpen(page);
  const deck = phone(page);
  await deck.getByTestId("decision-launcher").click();
  const dialog = deck.getByRole("dialog", { name: /One by one|하나씩/ });
  await expect(dialog).toBeVisible();
  await expect(deck.getByTestId("decision-deck-active-card")).toBeVisible();
  return dialog;
}

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
    '[data-testid="chat-turn"][data-newest="true"]',
  );
  await expect(newestTurn).toHaveCount(1);
  const newestBubble = newestTurn.locator(
    '.home-chat-bubble-row[data-newest="true"]',
  );
  await expect(newestBubble).toBeVisible();
  const animationName = await newestBubble.evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  expect(animationName).toContain("ij-thought-land");
});

test("card drag activates a directional environment before commit", async ({ page }) => {
  await addThought(page, `Directional card ${Date.now()}`);
  const dialog = await openDeck(page);
  const card = phone(page).getByTestId("decision-deck-active-card");
  const box = await card.boundingBox();
  expect(box).toBeTruthy();

  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + box!.width * 0.22, y, { steps: 12 });

  const outcome = card.getByTestId("decision-outcome-label");
  await expect(outcome).toHaveAttribute("data-outcome", "today");
  const auraOpacity = await dialog.evaluate(
    (element) => getComputedStyle(element, "::before").opacity,
  );
  expect(Number(auraOpacity)).toBeGreaterThan(0);

  await page.mouse.up();
  await expect(card).toBeVisible();
});

test("reduced motion removes the interaction animations", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await resetAppState(page);
  await addThought(page, `Reduced motion ${Date.now()}`);

  const bubble = phone(page).locator(
    '.home-chat-bubble-row[data-newest="true"]',
  );
  await expect(bubble).toBeVisible();
  const animationName = await bubble.evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  expect(animationName).toBe("none");

  await context.close();
});
