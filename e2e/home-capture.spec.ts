import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  addThought,
  phone,
  openContextMenuRaw,
  GUEST_INBOX_KEY,
  CAPTURE_LINK_NAME,
  contextMenuDialog,
  clickContextMenuItem,
} from "./helpers";

async function installSpeechMock(page: Page) {
  await page.addInitScript(() => {
    type Result = { isFinal: boolean; transcript: string };
    class MockSpeechRecognition {
      static last: MockSpeechRecognition | null = null;
      lang = "ko-KR";
      interimResults = true;
      continuous = false;
      onresult: ((e: SpeechRecognitionEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;
      private results: Result[] = [];

      constructor() {
        MockSpeechRecognition.last = this;
      }

      start() {
        MockSpeechRecognition.last = this;
      }

      stop() {
        this.onend?.();
      }

      emitInterim(transcript: string) {
        this.results = [{ isFinal: false, transcript }];
        this.dispatch();
      }

      emitFinal(transcript: string) {
        this.results = [{ isFinal: true, transcript }];
        this.dispatch();
      }

      emitInterimThenFinal(interim: string, final: string) {
        this.results = [{ isFinal: false, transcript: interim }];
        this.dispatch();
        this.results = [{ isFinal: true, transcript: final }];
        this.dispatch();
      }

      replayFinal(transcript: string) {
        this.results = [{ isFinal: true, transcript }];
        this.dispatch();
      }

      private dispatch() {
        const mapped = this.results.map((entry) => ({
          isFinal: entry.isFinal,
          0: { transcript: entry.transcript },
          length: 1,
        }));
        const results = mapped as unknown as SpeechRecognitionResultList;
        Object.defineProperty(results, "length", {
          value: mapped.length,
        });
        this.onresult?.({ results } as SpeechRecognitionEvent);
      }
    }

    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof SpeechRecognition;
    (
      window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }
    ).webkitSpeechRecognition = MockSpeechRecognition as unknown as typeof SpeechRecognition;

    (window as unknown as { __mockSpeech: typeof MockSpeechRecognition }).__mockSpeech =
      MockSpeechRecognition;
  });
}

async function startVoice(page: Page) {
  const close = phone(page).getByRole("button", { name: "Close" });
  if (await close.count()) await close.first().click();
  await phone(page).getByRole("button", { name: "Voice input" }).click();
  await page.waitForFunction(() => {
    const inst = (
      window as unknown as { __mockSpeech?: { last: { onresult: unknown } | null } }
    ).__mockSpeech?.last;
    return Boolean(inst?.onresult);
  });
}

async function mockSpeechEmit(
  page: Page,
  action: "emitInterim" | "emitFinal" | "emitInterimThenFinal" | "replayFinal",
  args: string[],
) {
  await page.evaluate(
    ({ action, args }) => {
      const inst = (
        window as unknown as {
          __mockSpeech: {
            last: {
              emitInterim: (t: string) => void;
              emitFinal: (t: string) => void;
              emitInterimThenFinal: (i: string, f: string) => void;
              replayFinal: (t: string) => void;
            } | null;
          };
        }
      ).__mockSpeech.last;
      if (!inst) throw new Error("speech mock not started");
      if (action === "emitInterim") inst.emitInterim(args[0]!);
      if (action === "emitFinal") inst.emitFinal(args[0]!);
      if (action === "emitInterimThenFinal")
        inst.emitInterimThenFinal(args[0]!, args[1]!);
      if (action === "replayFinal") inst.replayFinal(args[0]!);
    },
    { action, args },
  );
}

async function readComposerValue(page: Page) {
  return phone(page).locator("#capture-input").inputValue();
}

async function scrollMetrics(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".home-chat-lane");
    if (!el) return null;
    return {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      distanceFromBottom:
        el.scrollHeight - el.scrollTop - el.clientHeight,
    };
  });
}

async function isLatestTurnNearBottom(page: Page, text: string) {
  return page.evaluate(({ thoughtText }) => {
    const container = document.querySelector<HTMLElement>(".home-chat-lane");
    if (!container) return false;
    const turns = [...document.querySelectorAll(
      '[data-testid="chat-turn"], [data-testid="left-item-row"]',
    )];
    const turn = turns.find((node) => node.textContent?.includes(thoughtText));
    if (!turn) return false;
    const turnRect = turn.getBoundingClientRect();
    return turnRect.bottom <= container.getBoundingClientRect().bottom - 4;
  }, { thoughtText: text });
}

async function dragBubbleHorizontally(page: Page, text: string, deltaX: number) {
  const bubble = phone(page)
    .getByRole("paragraph")
    .filter({ hasText: text })
    .first();
  const box = await bubble.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, y, { steps: 10 });
  await page.mouse.up();
}

test.describe("Home capture UX", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test.describe("voice input", () => {
    test.beforeEach(async ({ page }) => {
      await installSpeechMock(page);
      await page.reload();
      await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor({ state: "visible" });
    });

    test("finalized voice transcript is inserted only once", async ({ page }) => {
      await startVoice(page);
      await mockSpeechEmit(page, "emitInterimThenFinal", [
        "지금 하고",
        "지금 하고 싶은 일",
      ]);
      await expect.poll(() => readComposerValue(page)).toBe("지금 하고 싶은 일");
    });

    test("pausing mid-sentence does not duplicate committed text", async ({ page }) => {
      await startVoice(page);
      await mockSpeechEmit(page, "emitInterim", ["지금"]);
      await expect.poll(() => readComposerValue(page)).toContain("지금");
      await mockSpeechEmit(page, "emitInterim", ["지금 하고"]);
      await mockSpeechEmit(page, "emitFinal", ["지금 하고 싶은 일"]);
      await expect.poll(() => readComposerValue(page)).toBe("지금 하고 싶은 일");
      const value = await readComposerValue(page);
      expect(value.match(/지금/g)?.length).toBe(1);
    });

    test("repeated speech callbacks do not duplicate committed text", async ({
      page,
    }) => {
      await startVoice(page);
      await mockSpeechEmit(page, "emitFinal", ["안녕하세요"]);
      await mockSpeechEmit(page, "emitFinal", ["안녕하세요"]);
      await mockSpeechEmit(page, "emitFinal", ["안녕하세요"]);
      await expect.poll(() => readComposerValue(page)).toBe("안녕하세요");
    });

    test("optimistic submit clears composer before item appears", async ({
      page,
    }) => {
      await phone(page).locator("#capture-input").fill("Optimistic capture test");
      await phone(page).locator('form.composer-hero button[type="submit"]').click();
      await expect(phone(page).locator("#capture-input")).toHaveValue("");
      await expect(phone(page).getByText("Optimistic capture test")).toBeVisible();
    });
  });

  test.describe("bottom-anchored chat scroll", () => {
    test("initial Home load shows the latest thought", async ({ page }) => {
      const stamp = Date.now();
      await page.evaluate(
        ({ key, rows }) => {
          localStorage.setItem(key, JSON.stringify(rows));
        },
        {
          key: GUEST_INBOX_KEY,
          rows: [
            {
              id: "older",
              text: `Older ${stamp}`,
              images: [],
              created_at: new Date(stamp - 60_000).toISOString(),
              status: "active",
            },
            {
              id: "newer",
              text: `Newer ${stamp}`,
              images: [],
              created_at: new Date(stamp).toISOString(),
              status: "active",
            },
          ],
        },
      );
      await page.reload();
      await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor({ state: "visible" });

      const turns = phone(page).locator(
        '[data-testid="chat-turn"], [data-testid="left-item-row"]',
      );
      await expect(turns.first()).toContainText(`Newer ${stamp}`);
      await expect(turns.nth(1)).toContainText(`Older ${stamp}`);
    });

    test("submitting a thought scrolls to the newest thought", async ({ page }) => {
      const first = `Scroll first ${Date.now()}`;
      const second = `Scroll second ${Date.now()}`;
      await addThought(page, first);
      await addThought(page, second);
      await expect
        .poll(async () => isLatestTurnNearBottom(page, second))
        .toBe(true);
    });

    test("manual upward scroll is not forcibly reset by unrelated renders", async ({
      page,
    }) => {
      const stamp = Date.now();
      for (let i = 0; i < 12; i += 1) {
        await addThought(page, `Bulk ${i} ${stamp}`);
      }

      await phone(page).locator("#capture-input").blur();
      const scroll = phone(page).locator(".home-chat-lane");
      await scroll.evaluate((el) => {
        el.scrollTop = 0;
      });
      // Let any late settle frames finish; user parking at top must stick.
      await page.waitForTimeout(350);
      await scroll.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.waitForTimeout(200);

      const parked = await scroll.evaluate((el) => {
        const max = el.scrollHeight - el.clientHeight;
        return { top: el.scrollTop, max };
      });
      expect(parked.max).toBeGreaterThan(200);
      expect(parked.top).toBeLessThan(parked.max - 80);

      // Soft CSS reflow (not window resize) must not yank to latest.
      await page.evaluate(() => {
        document.documentElement.style.setProperty("--e2e-reflow", "1");
      });
      await page.waitForTimeout(200);
      const after = await scroll.evaluate((el) => el.scrollTop);
      expect(after).toBeLessThan(parked.max - 80);

      // Sticky composer remains the reachable primary surface.
      const composer = phone(page).getByTestId("capture-submit");
      await expect(composer).toBeVisible();
      const box = await composer.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(40);
    });
  });

  test("Home thought swipe no longer reveals action buttons", async ({ page }) => {
    const text = `No swipe ${Date.now()}`;
    await addThought(page, text);
    await dragBubbleHorizontally(page, text, -180);
    await expect(
      phone(page).getByRole("button", { name: "Send to tasks" }),
    ).toHaveCount(0);
    await expect(
      phone(page).getByRole("button", { name: "Save to vault", exact: true }),
    ).toHaveCount(0);
  });

  test("long-press context menu still works", async ({ page }) => {
    const text = `Context ${Date.now()}`;
    await addThought(page, text);
    await openContextMenuRaw(page, text);
    await expect(
      contextMenuDialog(page).getByRole("menuitem", { name: "Save to vault", exact: true }),
    ).toBeVisible();
  });

  test("sticky launcher is absent; ··· opens DecisionDeck", async ({ page }) => {
    const stamp = Date.now();
    const a = `Launcher A ${stamp}`;
    const b = `Launcher B ${stamp}`;
    await addThought(page, a);
    await addThought(page, b);

    await expect(phone(page).getByTestId("decision-launcher")).toHaveCount(0);
    await expect(phone(page).getByTestId("left-items-section")).toBeVisible();

    await phone(page)
      .getByTestId("left-item-row")
      .filter({ hasText: b })
      .getByTestId("left-item-more")
      .click();
    await clickContextMenuItem(page, "Sort one by one");
    await expect(
      phone(page).getByRole("dialog", { name: "One by one" }),
    ).toBeVisible();
  });
});
