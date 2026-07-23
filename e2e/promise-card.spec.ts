import { test, expect } from "@playwright/test";
import {
  resetAppState,
  phone,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  readGuestList,
} from "./helpers";
import {
  buildPromiseCard,
  validatePromiseHonesty,
} from "../src/lib/promiseCard";

test.describe("promise card (unit)", () => {
  test("schedule with detected date offers confirm, not resurface promise", () => {
    const card = buildPromiseCard("내일 오후 3시 병원", "ko");
    expect(card.primaryAction).toBe("confirm_schedule");
    expect(card.detectedDate).not.toBeNull();
    expect(card.promise).toMatch(/잡을까요/);
    expect(card.promise).not.toMatch(/다시\s*보여/);
    expect(validatePromiseHonesty(card)).toEqual([]);
  });

  test("task without date keeps inbox-only promise", () => {
    const card = buildPromiseCard("보고서 초안 작성하기", "ko");
    expect(card.primaryAction).toBe("keep_task");
    expect(card.actualAction).toBe("inbox_only");
    expect(card.promise).not.toMatch(/알려|알림/);
    expect(validatePromiseHonesty(card)).toEqual([]);
  });

  test("idea suggests archive with rediscovery-eligible copy", () => {
    const card = buildPromiseCard(
      "앱 온보딩에서 promise card를 더 부드럽게 보여주는 아이디어",
      "ko",
    );
    expect(card.primaryAction).toBe("archive");
    expect(card.rediscoveryEligible).toBe(true);
    expect(card.promise).toMatch(/며칠/);
    expect(validatePromiseHonesty(card)).toEqual([]);
  });

  test("link stays inbox-only without rediscovery promise", () => {
    const card = buildPromiseCard("https://example.com/docs", "en");
    expect(card.category).toBe("link");
    expect(card.rediscoveryEligible).toBe(false);
    expect(card.promise).not.toMatch(/revisit|few days/i);
    expect(validatePromiseHonesty(card)).toEqual([]);
  });

  test("low-confidence capture avoids overclaiming", () => {
    const card = buildPromiseCard("hm", "en");
    expect(card.confidence).toBeGreaterThan(0);
    expect(card.promise).not.toMatch(/notify|remind|show you again/i);
    expect(validatePromiseHonesty(card)).toEqual([]);
  });

  test("primary action matches actual action contract", () => {
    const samples = [
      "내일 3시 미팅",
      "우유 사기",
      "https://news.ycombinator.com",
      "새로운 카드 UI 아이디어 메모",
    ];
    for (const text of samples) {
      const card = buildPromiseCard(text, "ko");
      if (card.primaryAction === "confirm_schedule") {
        expect(card.actualAction).toBe("schedule_on_confirm");
        expect(card.detectedDate).not.toBeNull();
      }
      if (card.primaryAction === "archive") {
        expect(card.actualAction).toBe("archive_on_confirm");
      }
      expect(validatePromiseHonesty(card)).toEqual([]);
    }
  });
});

test.describe("promise card (E2E)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("schedule promise keeps inbox until confirmed, then shows on Tasks", async ({
    page,
  }) => {
    const text = "내일 오후 3시 병원";
    const frame = phone(page);
    const input = frame.locator("textarea").first();
    await input.fill(text);
    await frame.getByRole("button", { name: "Leave it", exact: true }).click();

    await frame.getByTestId("promise-card").waitFor({ state: "visible" });
    await expect(frame.getByTestId("promise-primary")).toHaveText(
      "Schedule as suggested",
    );
    await page.screenshot({
      path: "test-results/promise-card-schedule.png",
      fullPage: false,
    });

    let inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(1);
    let schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    expect(schedules.length).toBe(0);

    await frame.getByTestId("promise-primary").click();
    await frame.getByTestId("promise-card").waitFor({ state: "hidden" });

    inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(0);
    schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    expect(schedules.length).toBe(1);
    expect((schedules[0] as { text: string }).text).toContain("병원");

    await frame.getByRole("link", { name: /^Tasks/ }).click();
    await expect(frame.getByText("병원", { exact: false })).toBeVisible();
  });

  test("idea input does not auto-create schedule", async ({ page }) => {
    const text = `Quiet idea ${Date.now()}`;
    const frame = phone(page);
    await frame.locator("textarea").first().fill(text);
    await frame.getByRole("button", { name: "Leave it", exact: true }).click();
    await frame.getByTestId("promise-card").waitFor({ state: "visible" });

    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    expect(schedules.length).toBe(0);

    await frame.locator(".bg-white\\/38").first().click({ position: { x: 8, y: 8 } });
    await frame.getByTestId("promise-card").waitFor({ state: "hidden" });

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(1);
  });
});
