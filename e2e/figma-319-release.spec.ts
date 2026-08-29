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

  test("primary navigation is Capture and Schedule; Schedule is one Today + Upcoming surface", async ({ page }) => {
    const frame = phone(page);
    await expect(frame.getByRole("link", { name: CAPTURE_LINK_NAME })).toBeVisible();
    await expect(frame.getByRole("link", { name: /^Schedule/ })).toBeVisible();
    await expect(frame.getByRole("link", { name: /^Archive/ })).toHaveCount(0);

    await frame.getByRole("link", { name: /^Schedule/ }).click();
    await expect(frame.getByRole("heading", { name: "My schedule" })).toBeVisible();
    await expect(frame.getByTestId("schedule-unified-view")).toBeVisible();
    await expect(frame.getByTestId("schedule-empty")).toBeVisible();
    await expect(frame.getByTestId("schedule-section-today")).toHaveCount(0);
    await expect(frame.getByTestId("schedule-section-upcoming")).toHaveCount(0);
    await expect(frame.getByRole("tab")).toHaveCount(0);
    await expect(frame.getByText("Calendar", { exact: true })).toHaveCount(0);

    await page.evaluate(() => {
      const now = new Date();
      const todayStart = new Date(now.getTime() + 30 * 60 * 1000);
      const todayEnd = new Date(todayStart.getTime() + 60 * 60 * 1000);
      const tomorrowStart = new Date(now);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      tomorrowStart.setHours(12, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrowStart.getTime() + 60 * 60 * 1000);

      localStorage.setItem(
        "itjima.guest.schedules",
        JSON.stringify([
          {
            id: "figma-319-today",
            text: "Today contract item",
            start_time: todayStart.toISOString(),
            end_time: todayEnd.toISOString(),
            alarm: false,
            created_at: now.toISOString(),
            status: "active",
          },
          {
            id: "figma-319-upcoming",
            text: "Upcoming contract item",
            start_time: tomorrowStart.toISOString(),
            end_time: tomorrowEnd.toISOString(),
            alarm: false,
            created_at: now.toISOString(),
            status: "active",
          },
        ]),
      );
    });
    await page.reload();

    await expect(frame.getByTestId("schedule-empty")).toHaveCount(0);
    await expect(frame.getByTestId("schedule-section-today")).toBeVisible();
    await expect(frame.getByTestId("schedule-section-upcoming")).toBeVisible();
    await expect(frame.getByText("Today contract item")).toBeVisible();
    await expect(frame.getByText("Upcoming contract item")).toBeVisible();
    await expect(frame.getByRole("tab")).toHaveCount(0);
    await expect(frame.getByText("Calendar", { exact: true })).toHaveCount(0);
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