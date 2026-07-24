import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  addThought,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  GUEST_ARCHIVE_KEY,
} from "./helpers";
import { resolveDragOutcome } from "../src/lib/decision";

async function installAnalyticsSpy(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents = [];
    window.gtag = (...args: unknown[]) => {
      (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents.push(args);
    };
  });
}

async function readAnalytics(page: Page) {
  return page.evaluate(() => (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents ?? []);
}

async function openDeck(page: Page) {
  await phone(page).getByTestId("decision-launcher").click();
  await phone(page)
    .getByRole("dialog", { name: "One by one" })
    .waitFor({ state: "visible" });
}

async function dragDeckCard(page: Page, deltaX: number) {
  const card = phone(page).getByTestId("decision-deck-active-card");
  await card.waitFor({ state: "visible" });
  const box = await card.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, y, { steps: 14 });
  await page.mouse.up();
}

test.describe("Decision deck 3-state swipe", () => {
  test.beforeEach(async ({ page }) => {
    await installAnalyticsSpy(page);
    await resetAppState(page);
  });

  test("threshold helper matches card-width ratios", () => {
    expect(resolveDragOutcome(-80, 320)).toBe("today");
    expect(resolveDragOutcome(-50, 320)).toBeNull();
    expect(resolveDragOutcome(120, 320)).toBe("later");
    expect(resolveDragOutcome(220, 320)).toBe("archive");
  });

  test("legacy inbox rows without decision fields still open in deck", async ({
    page,
  }) => {
    const stamp = Date.now();
    await page.evaluate(
      ({ key, rows }) => {
        localStorage.setItem(key, JSON.stringify(rows));
      },
      {
        key: GUEST_INBOX_KEY,
        rows: [
          {
            id: "legacy-1",
            text: `Legacy thought ${stamp}`,
            images: [],
            created_at: new Date().toISOString(),
            status: "active",
          },
        ],
      },
    );
    await page.reload();
    await phone(page).getByRole("link", { name: /^Throw/ }).waitFor({ state: "visible" });
    await openDeck(page);
    await expect(phone(page).getByText(`Legacy thought ${stamp}`)).toBeVisible();
  });

  test("below-threshold drag snaps back", async ({ page }) => {
    const text = `Snap back ${Date.now()}`;
    await addThought(page, text);
    await openDeck(page);
    const card = phone(page).getByTestId("decision-deck-active-card");
    const width = (await card.boundingBox())!.width;
    await dragDeckCard(page, width * 0.12);
    await expect(card).toBeVisible();
    await expect(phone(page).getByTestId("decision-deck-complete")).toHaveCount(0);
  });

  test("left swipe decides Today", async ({ page }) => {
    const text = `Today swipe ${Date.now()}`;
    await addThought(page, text);
    await openDeck(page);
    const width = (await phone(page).getByTestId("decision-deck-active-card").boundingBox())!.width;
    await dragDeckCard(page, -width * 0.35);
    await expect
      .poll(async () => (await readGuestList(page, GUEST_SCHEDULE_KEY)).length)
      .toBe(1);
    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(0);
  });

  test("medium right swipe decides Later", async ({ page }) => {
    const text = `Later swipe ${Date.now()}`;
    await addThought(page, text);
    await openDeck(page);
    const width = (await phone(page).getByTestId("decision-deck-active-card").boundingBox())!.width;
    await dragDeckCard(page, width * 0.4);
    await expect
      .poll(async () => {
        const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as {
          text: string;
          decision?: string;
        }[];
        return inbox.find((row) => row.text === text)?.decision;
      })
      .toBe("later");
  });

  test("deep right swipe archives", async ({ page }) => {
    const text = `Archive swipe ${Date.now()}`;
    await addThought(page, text);
    await openDeck(page);
    const width = (await phone(page).getByTestId("decision-deck-active-card").boundingBox())!.width;
    await dragDeckCard(page, width * 0.72);
    await expect
      .poll(async () => (await readGuestList(page, GUEST_ARCHIVE_KEY)).length)
      .toBe(1);
    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(0);
  });

  test("action buttons mirror swipe outcomes", async ({ page }) => {
    const first = `Button today ${Date.now()}`;
    const second = `Button later ${Date.now()}`;
    await addThought(page, first);
    await addThought(page, second);
    await openDeck(page);
    const deck = phone(page);
    const activeCard = deck.getByTestId("decision-deck-active-card");
    // Deck shows newest first, so the top card is `second`.
    await expect(activeCard.getByText(second)).toBeVisible();
    await deck.getByTestId("decision-btn-today").click();
    await expect
      .poll(async () => {
        const schedule = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as {
          text: string;
        }[];
        return schedule.some((row) => row.text === second);
      })
      .toBe(true);
    await expect(activeCard.getByText(first)).toBeVisible();
    await deck.getByTestId("decision-btn-later").click();
    await expect
      .poll(async () => {
        const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as {
          text: string;
          decision?: string;
        }[];
        return inbox.some((row) => row.text === first && row.decision === "later");
      })
      .toBe(true);
  });

  test("analytics events omit thought content", async ({ page }) => {
    const text = `Analytics ${Date.now()}`;
    await addThought(page, text);
    await openDeck(page);
    await phone(page).getByTestId("decision-btn-archive").click();
    await expect
      .poll(async () => (await readGuestList(page, GUEST_ARCHIVE_KEY)).length)
      .toBe(1);
    const events = await readAnalytics(page);
    const serialized = JSON.stringify(events);
    expect(serialized).toContain("decision_archive");
    expect(serialized).not.toContain(text);
  });

  test("undo restores the latest decision", async ({ page }) => {
    const text = `Undo me ${Date.now()}`;
    await addThought(page, text);
    await openDeck(page);
    await phone(page).getByTestId("decision-btn-later").click();
    await expect(phone(page).getByTestId("decision-undo")).toBeVisible();
    await phone(page).getByTestId("decision-undo").click();
    await expect(
      phone(page).getByTestId("decision-deck-active-card").getByText(text),
    ).toBeVisible();
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as {
      text: string;
      decision?: string;
    }[];
    expect(inbox.some((row) => row.text === text && !row.decision)).toBe(true);
  });

  test("completion summary shows outcome counts", async ({ page }) => {
    const a = `Complete A ${Date.now()}`;
    const b = `Complete B ${Date.now()}`;
    const c = `Complete C ${Date.now()}`;
    await addThought(page, a);
    await addThought(page, b);
    await addThought(page, c);
    await openDeck(page);
    await phone(page).getByTestId("decision-btn-today").click();
    await phone(page).getByTestId("decision-btn-later").click();
    await phone(page).getByTestId("decision-btn-archive").click();
    const complete = phone(page).getByTestId("decision-deck-complete");
    await complete.waitFor({ state: "visible" });
    await expect(complete.getByText("All sorted")).toBeVisible();
    await expect(complete.getByText("You decided 3 thoughts")).toBeVisible();
    const rows = complete.locator("dd");
    await expect(rows.nth(0)).toHaveText("1");
    await expect(rows.nth(1)).toHaveText("1");
    await expect(rows.nth(2)).toHaveText("1");
  });
});
