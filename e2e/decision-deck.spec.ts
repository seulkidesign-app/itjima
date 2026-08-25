import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  addThought,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  GUEST_ARCHIVE_KEY,
  dismissInlinePromise,
  closeDecisionDeckIfOpen,
  CAPTURE_LINK_NAME,
} from "./helpers";
import {
  resolveDragOutcome,
  previewDragOutcome,
  shouldCommitDrag,
} from "../src/lib/decision";

async function installAnalyticsSpy(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents = [];
    window.gtag = (...args: unknown[]) => {
      (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents.push(args);
    };
  });
}

async function readAnalytics(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents ?? [],
  );
}

async function openDeck(page: Page) {
  const deck = phone(page);
  await dismissInlinePromise(page);
  await closeDecisionDeckIfOpen(page);
  const dialog = deck.getByRole("dialog", { name: "One by one" });
  const more = deck.getByTestId("left-item-more").last();
  await more.click();
  await page.getByTestId("inbox-context-menu")
    .getByRole("menuitem", { name: "Sort one by one", exact: true })
    .click({ force: true });
  await dialog.waitFor({ state: "visible" });
  await waitForDeckReady(page);
}

async function closeDeck(page: Page) {
  const dialog = phone(page).getByRole("dialog", { name: "One by one" });
  if (await dialog.isVisible()) {
    await dialog.getByRole("button", { name: /Close|닫기/ }).click();
    await dialog.waitFor({ state: "hidden" });
  }
}

async function waitForDeckReady(page: Page) {
  const deck = phone(page);
  await expect
    .poll(async () => deck.getByTestId("decision-btn-today").isEnabled())
    .toBe(true);
}

async function clickDeckDecision(
  page: Page,
  testId: "decision-btn-today" | "decision-btn-later" | "decision-btn-archive",
) {
  const deck = phone(page);
  await waitForDeckReady(page);
  await deck.getByTestId(testId).click();
}

async function confirmDeckSchedule(page: Page) {
  const flow = page.getByTestId("schedule-choice-flow");
  await expect(flow).toBeVisible({ timeout: 15_000 });
  await flow.getByRole("button", { name: /selected$/i }).click();
  await flow
    .getByRole("button", { name: "Set a reminder", exact: true })
    .click();
  await flow
    .getByRole("button", { name: "No reminder", exact: true })
    .click();
  await flow.getByRole("button", { name: /Add to schedule/i }).click();
  await expect(flow).toBeHidden({ timeout: 15_000 });
}

async function dragDeckCard(page: Page, deltaX: number, deltaY = 0) {
  const card = phone(page).getByTestId("decision-deck-active-card");
  await card.waitFor({ state: "visible" });
  const box = await card.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, y + deltaY, { steps: 16 });
  await page.mouse.up();
}

test.describe("Decision deck swipe", () => {
  test.beforeEach(async ({ page }) => {
    await installAnalyticsSpy(page);
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
    await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor({
      state: "visible",
    });
    await openDeck(page);
    await expect(
      phone(page)
        .getByTestId("decision-deck-active-card")
        .getByText(`Legacy thought ${stamp}`),
    ).toBeVisible();
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

  test("right swipe opens schedule setup and saves only after confirmation", async ({
    page,
  }) => {
    const text = `Schedule swipe ${Date.now()}`;
    await addThought(page, text);
    await openDeck(page);
    const width = (
      await phone(page).getByTestId("decision-deck-active-card").boundingBox()
    )!.width;
    await dragDeckCard(page, width * 0.38);

    const flow = page.getByTestId("schedule-choice-flow");
    await expect(flow).toBeVisible({ timeout: 15_000 });
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);

    await confirmDeckSchedule(page);
    await expect
      .poll(async () => (await readGuestList(page, GUEST_SCHEDULE_KEY)).length)
      .toBe(1);
    // M1: DecisionDeck today keeps the canonical inbox record.
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
  });

  test("left swipe archives", async ({ page }) => {
    const text = `Archive swipe ${Date.now()}`;
    await addThought(page, text);
    await openDeck(page);
    const width = (
      await phone(page).getByTestId("decision-deck-active-card").boundingBox()
    )!.width;
    await dragDeckCard(page, -width * 0.38);
    await expect
      .poll(async () => (await readGuestList(page, GUEST_ARCHIVE_KEY)).length)
      .toBe(1);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(0);
  });

  test("down swipe keeps (Later)", async ({ page }) => {
    const text = `Keep swipe ${Date.now()}`;
    await addThought(page, text);
    await openDeck(page);
    const height = (
      await phone(page).getByTestId("decision-deck-active-card").boundingBox()
    )!.height;
    await dragDeckCard(page, 0, height * 0.32);
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

  test("outcome label updates during drag", async ({ page }) => {
    await addThought(page, `Label drag ${Date.now()}`);
    await openDeck(page);
    const card = phone(page).getByTestId("decision-deck-active-card");
    const box = await card.boundingBox();
    expect(box).toBeTruthy();
    const width = box!.width;
    const height = box!.height;
    const startX = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const label = card.locator('[data-testid="decision-outcome-label"]');

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX + width * 0.2, y, { steps: 10 });
    await expect.poll(async () => label.getAttribute("data-outcome")).toBe("today");
    await page.mouse.up();
    await expect(card).toBeVisible();

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - width * 0.2, y, { steps: 12 });
    await expect.poll(async () => label.getAttribute("data-outcome")).toBe("archive");
    await page.mouse.up();
    await expect(card).toBeVisible();

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX, y + height * 0.18, { steps: 12 });
    await expect.poll(async () => label.getAttribute("data-outcome")).toBe("later");
    await page.mouse.up();
    await expect(card).toBeVisible();
    await closeDeck(page);
  });

  test("later item does not reappear in the same deck session", async ({
    page,
  }) => {
    const stamp = Date.now();
    const older = `Older ${stamp}`;
    const newer = `Newer ${stamp}`;
    await addThought(page, older);
    await addThought(page, newer);
    await openDeck(page);

    const activeCard = phone(page).getByTestId("decision-deck-active-card");
    await expect(activeCard.getByText(newer)).toBeVisible();
    await clickDeckDecision(page, "decision-btn-later");
    await expect(activeCard.getByText(older)).toBeVisible();
    await expect(activeCard.getByText(newer)).toHaveCount(0);
  });

  test("action buttons mirror swipe outcomes", async ({ page }) => {
    const stamp = Date.now();
    const first = `Thought A ${stamp}`;
    const second = `Thought B ${stamp}`;
    await addThought(page, first);
    await addThought(page, second);
    await openDeck(page);
    const deck = phone(page);
    const activeCard = deck.getByTestId("decision-deck-active-card");
    await expect(activeCard.getByText(second)).toBeVisible();
    await clickDeckDecision(page, "decision-btn-today");
    await confirmDeckSchedule(page);
    await expect
      .poll(async () => {
        const schedule = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as {
          text: string;
        }[];
        return schedule.some((row) => row.text === second);
      })
      .toBe(true);
    await expect(activeCard.getByText(first)).toBeVisible();
    await clickDeckDecision(page, "decision-btn-later");
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
    expect(serialized).toContain("swipe_committed");
    expect(serialized).not.toContain(text);
  });

  test("undo restores the latest decision as active card", async ({ page }) => {
    const text = `Undo me ${Date.now()}`;
    await addThought(page, text);
    await openDeck(page);
    await clickDeckDecision(page, "decision-btn-later");
    await expect(phone(page).getByTestId("decision-undo")).toBeVisible();
    await phone(page).getByTestId("decision-undo").click();
    await expect(
      phone(page).getByTestId("decision-deck-active-card").getByText(text),
    ).toBeVisible();
  });

  test("completion summary shows session counts", async ({ page }) => {
    const a = `Complete A ${Date.now()}`;
    const b = `Complete B ${Date.now()}`;
    const c = `Complete C ${Date.now()}`;
    await addThought(page, a);
    await addThought(page, b);
    await addThought(page, c);
    await openDeck(page);
    const deck = phone(page);
    await clickDeckDecision(page, "decision-btn-today");
    await confirmDeckSchedule(page);
    await clickDeckDecision(page, "decision-btn-later");
    await clickDeckDecision(page, "decision-btn-archive");
    const complete = deck.getByTestId("decision-deck-complete");
    await expect(complete).toBeVisible({ timeout: 15_000 });
    await expect(complete.getByText(/Schedule 1|일정 1/)).toBeVisible();
    await expect(complete.getByText(/Vault 1|보관 1/)).toBeVisible();
    await expect(complete.getByText(/Kept 1|그대로 1/)).toBeVisible();
  });

  test("first-time tutorial appears once", async ({ page }) => {
    await page.evaluate(() =>
      localStorage.removeItem("itjima.swipe.tutorial.done"),
    );
    await addThought(page, `Tutorial ${Date.now()}`);
    await openDeck(page);
    await expect(phone(page).getByTestId("swipe-tutorial")).toBeVisible();
    await phone(page).getByTestId("swipe-tutorial").getByRole("button", {
      name: /Got it|알겠어요/,
    }).click();
    await expect(phone(page).getByTestId("swipe-tutorial")).toHaveCount(0);
  });
});
