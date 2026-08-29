import { expect, test } from "@playwright/test";
import {
  GUEST_INBOX_KEY,
  CAPTURE_LINK_NAME,
  phone,
  resetAppState,
} from "./helpers";
import { appendFinalSpeech, normalizeSpeechSegment } from "../src/lib/speechInput";

test.describe("Figma 319 release contract", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("brand-new Empty Home stays quiet", async ({ page }) => {
    const frame = phone(page);
    await expect(frame.getByTestId("home-empty-hero")).toBeVisible();
    await expect(frame.getByTestId("open-all-records")).toHaveCount(0);
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
    const history = frame.getByTestId("open-all-records");
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

  test("voice affordance meets the mobile touch target and transcript logic stays stable", async ({ page }) => {
    const frame = phone(page);
    const voice = frame.getByRole("button", { name: "Voice input" });
    await expect(voice).toBeVisible();
    const box = await voice.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);

    expect(normalizeSpeechSegment("  내일   치과!!!")).toBe("내일 치과");
    expect(appendFinalSpeech("", "내일 치과")).toBe("내일 치과");
    expect(appendFinalSpeech("내일 치과", "내일 치과.")).toBe("내일 치과");
    expect(appendFinalSpeech("내일", "내일 치과")).toBe("내일 치과");
    expect(appendFinalSpeech("내일 치과", "3시에 예약")).toBe("내일 치과 3시에 예약");
  });
});
