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
  await deck.getByTestId("left-item-more").last().click();
  await page
    .getByTestId("inbox-context-menu")
    .getByRole("menuitem", { name: /Sort one by one|하나씩 정리하기/, exact: true })
    .click({ force: true });
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
  await expect
    .poll(async () =>
      Number(
        await dialog.evaluate(
          (element) => getComputedStyle(element, "::before").opacity,
        ),
      ),
    )
    .toBeGreaterThan(0);

  await page.mouse.up();
  await expect(card).toBeVisible();
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
