import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
} from "./helpers";

async function submitKo(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.getByRole("button", { name: "남기기", exact: true }).click();
}

test.describe("M1 hardening capture contracts", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
    await page.reload();
  });

  test("undated capture stays on record only", async ({ page }) => {
    await submitKo(page, "엄마 선물 알아보기");
    await expect(
      phone(page).getByText("엄마 선물 알아보기", { exact: true }).first(),
    ).toBeVisible();
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      temporal_state?: string;
    }>;
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.temporal_state === "no_time" || !inbox[0]?.temporal_state).toBe(
      true,
    );
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(0);
  });

  test("exact datetime keeps record and creates projection", async ({ page }) => {
    await submitKo(page, "내일 오후 3시 치과");
    await expect(
      phone(page).getByTestId("saved-schedule-feedback"),
    ).toBeVisible();
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      id?: string;
      temporal_state?: string;
      start_time?: string;
    }>;
    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<{
      id?: string;
      source_id?: string;
    }>;
    expect(inbox).toHaveLength(1);
    expect(schedules).toHaveLength(1);
    expect(inbox[0]?.temporal_state).toBe("exact_datetime");
    expect(inbox[0]?.start_time).toBeTruthy();
    expect(
      schedules[0]?.id === inbox[0]?.id ||
        schedules[0]?.source_id === inbox[0]?.id,
    ).toBe(true);
  });

  test("ambiguous capture keeps record without schedule", async ({ page }) => {
    await submitKo(page, "내일 3시 치과");
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toBeVisible();
  });

  test("clarification creates projection while keeping record", async ({
    page,
  }) => {
    await submitKo(page, "내일 3시 치과");
    const promise = phone(page).getByTestId("inline-promise").last();
    await promise.getByTestId("promise-confirm-afternoon").click();
    await expect(
      phone(page).getByTestId("saved-schedule-feedback"),
    ).toBeVisible();
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("undo clears projection and keeps record", async ({ page }) => {
    await submitKo(page, "내일 오후 3시 치과");
    await expect(
      phone(page).getByTestId("saved-schedule-feedback"),
    ).toBeVisible();
    const undo = page.getByRole("button", { name: /되돌리기|Undo/i }).first();
    await expect(undo).toBeVisible();
    await undo.click();
    await expect.poll(async () => {
      return (await readGuestList(page, GUEST_SCHEDULE_KEY)).length;
    }).toBe(0);
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      temporal_state?: string;
      start_time?: string | null;
    }>;
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.temporal_state === "no_time" || !inbox[0]?.start_time).toBe(
      true,
    );
  });
});
