import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  addThought,
  phone,
  openContextMenuRaw,
  GUEST_INBOX_KEY,
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
    const el = document.getElementById("phone-scroll");
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
    const container = document.getElementById("phone-scroll");
    if (!container) return false;
    const turns = [...document.querySelectorAll('[data-testid="chat-turn"]')];
    const turn = turns.find((node) => node.textContent?.includes(thoughtText));
    if (!turn) return false;
    const sticky = document.querySelector(".sticky.bottom-0");
    const stickyTop =
      sticky?.getBoundingClientRect().top ?? container.getBoundingClientRect().bottom;
    const turnRect = turn.getBoundingClientRect();
    return turnRect.bottom <= stickyTop - 4;
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
      await phone(page).getByRole("link", { name: /^Throw/ }).waitFor({ state: "visible" });
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

    test("restarting voice recognition does not duplicate prior text", async ({ page }) => {
      await startVoice(page);
      await mockSpeechEmit(page, "emitFinal", ["지금 하고 싶은 일"]);
      await expect.poll(() => readComposerValue(page)).toBe("지금 하고 싶은 일");

      await phone(page).getByRole("button", { name: "Voice input" }).click();
      await startVoice(page);
      await mockSpeechEmit(page, "replayFinal", ["지금 하고 싶은 일"]);
      await page.waitForTimeout(200);
      expect(await readComposerValue(page)).toBe("지금 하고 싶은 일");
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
      await phone(page).getByRole("link", { name: /^Throw/ }).waitFor({ state: "visible" });

      await expect
        .poll(async () => isLatestTurnNearBottom(page, `Newer ${stamp}`))
        .toBe(true);
      const metrics = await scrollMetrics(page);
      expect(metrics?.distanceFromBottom ?? 999).toBeLessThan(160);
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
      for (let i = 0; i < 8; i += 1) {
        await addThought(page, `Bulk ${i} ${stamp}`);
      }
      await page.evaluate(() => {
        const el = document.getElementById("phone-scroll");
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      });
      await expect
        .poll(async () => (await scrollMetrics(page))!.distanceFromBottom < 240)
        .toBe(true);

      const beforeScrollUp = await scrollMetrics(page);
      await page.evaluate(() => {
        const el = document.getElementById("phone-scroll");
        if (el) {
          el.scrollTop = 0;
          el.dispatchEvent(new Event("scroll"));
        }
      });
      const scrolledUp = await scrollMetrics(page);
      expect(scrolledUp?.scrollTop ?? 999).toBeLessThan(40);

      await page.evaluate(() => {
        window.dispatchEvent(new Event("resize"));
      });
      await page.waitForTimeout(400);

      const after = await scrollMetrics(page);
      expect(after?.scrollTop ?? 999).toBeLessThan(
        Math.max(80, (beforeScrollUp?.scrollTop ?? 0) + 40),
      );
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
      phone(page).getByRole("dialog").getByRole("button", { name: "Save to vault", exact: true }),
    ).toBeVisible();
  });

  test("compact launcher preserves count and opens DecisionDeck", async ({ page }) => {
    const stamp = Date.now();
    await addThought(page, `Launcher A ${stamp}`);
    await addThought(page, `Launcher B ${stamp}`);

    const launcher = phone(page).getByTestId("decision-launcher");
    await expect(launcher).toBeVisible();
    await expect(phone(page).getByTestId("decision-launcher-count")).toHaveText(
      "2 thoughts to decide",
    );
    await expect(launcher.locator("span.pill-yellow")).toHaveText("Decide");

    await launcher.click();
    await expect(
      phone(page).getByRole("dialog", { name: "One by one" }),
    ).toBeVisible();
  });
});
