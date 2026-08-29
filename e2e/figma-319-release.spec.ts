import { expect, test, type Page } from "@playwright/test";
import {
  GUEST_INBOX_KEY,
  CAPTURE_LINK_NAME,
  phone,
  resetAppState,
} from "./helpers";

async function installSpeechMock(page: Page) {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      static last: MockSpeechRecognition | null = null;
      lang = "ko-KR";
      interimResults = true;
      continuous = false;
      onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
      onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
      onend: (() => void) | null = null;

      constructor() {
        MockSpeechRecognition.last = this;
      }

      start() {
        MockSpeechRecognition.last = this;
      }

      stop() {
        this.onend?.();
      }

      emitFinal(transcript: string) {
        const result = {
          isFinal: true,
          0: { transcript },
          length: 1,
        } as unknown as SpeechRecognitionResult;
        const results = [result] as unknown as SpeechRecognitionResultList;
        Object.defineProperty(results, "length", { value: 1 });
        this.onresult?.({ results } as SpeechRecognitionEvent);
      }
    }

    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: MockSpeechRecognition,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: MockSpeechRecognition,
    });
    Object.defineProperty(window, "__figma319Speech", {
      configurable: true,
      value: MockSpeechRecognition,
    });
  });
}

test.describe("Figma 319 release contract", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("brand-new Empty Home stays quiet", async ({ page }) => {
    const frame = phone(page);
    await expect(frame.getByTestId("home-empty-hero")).toBeVisible();
    await expect(frame.getByTestId("open-all-records-history")).toHaveCount(0);
  });

  test("history remains reachable when no active records remain", async ({ page }) => {
    const marker = `Completed history ${Date.now()}`;
    await page.evaluate(
      ({ key, marker }) => {
        localStorage.setItem(
          key,
          JSON.stringify([
            {
              id: "done-history",
              text: marker,
              images: [],
              created_at: new Date().toISOString(),
              status: "done",
              temporal_state: "no_time",
            },
          ]),
        );
      },
      { key: GUEST_INBOX_KEY, marker },
    );
    await page.reload();

    const frame = phone(page);
    await expect(frame.getByTestId("home-empty-hero")).toBeVisible();
    const history = frame.getByTestId("open-all-records-history");
    await expect(history).toBeVisible();
    await history.click();

    await expect(frame.getByTestId("records-browse-sheet")).toBeVisible();
    const row = frame
      .getByTestId("records-browse-row")
      .filter({ hasText: marker })
      .first();
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("data-status", "done");
  });

  test("primary navigation is Capture and Schedule; Schedule is Today and Upcoming", async ({ page }) => {
    const frame = phone(page);
    await expect(frame.getByRole("link", { name: CAPTURE_LINK_NAME })).toBeVisible();
    await expect(frame.getByRole("link", { name: /^Schedule/ })).toBeVisible();
    await expect(frame.getByRole("link", { name: /^Archive/ })).toHaveCount(0);

    await frame.getByRole("link", { name: /^Schedule/ }).click();
    await expect(frame.getByRole("heading", { name: "Schedule" })).toBeVisible();
    await expect(frame.getByRole("tab", { name: "Today" })).toBeVisible();
    await expect(frame.getByRole("tab", { name: "Upcoming" })).toBeVisible();
    await expect(frame.getByRole("tab", { name: "Calendar" })).toHaveCount(0);
  });

  test("voice capture remains usable and meets the mobile touch target", async ({ page }) => {
    await installSpeechMock(page);
    await page.reload();

    const frame = phone(page);
    const voice = frame.getByRole("button", { name: "Voice input" });
    await expect(voice).toBeVisible();
    const box = await voice.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await voice.click();
    await page.waitForFunction(() => {
      const ctor = (
        window as unknown as {
          __figma319Speech?: { last: { onresult: unknown } | null };
        }
      ).__figma319Speech;
      return Boolean(ctor?.last?.onresult);
    });
    await page.evaluate(() => {
      const ctor = (
        window as unknown as {
          __figma319Speech: {
            last: { emitFinal: (text: string) => void } | null;
          };
        }
      ).__figma319Speech;
      ctor.last?.emitFinal("Voice contract works");
    });

    await expect(frame.locator("#capture-input")).toHaveValue("Voice contract works");
  });
});
