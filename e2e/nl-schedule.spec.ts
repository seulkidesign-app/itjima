import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  gotoScheduleUpcoming,
} from "./helpers";

async function submit(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.locator('form.composer-hero button[type="submit"]').click();
  await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
}

async function submitKo(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.getByRole("button", { name: "남기기", exact: true }).click();
  await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
}

test.describe("Natural-language scheduling", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("clear English schedule confirms in one tap", async ({ page }) => {
    await submit(page, "Dentist tomorrow at 3pm");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "schedule_exact");
    await expect(promise).toHaveAttribute("data-confidence", "high");
    await expect(promise.getByTestId("promise-primary")).toHaveText("Add to schedule");
    await promise.getByTestId("promise-primary").click();
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
    await gotoScheduleUpcoming(page);
    await expect(phone(page).getByText(/Dentist/i).first()).toBeVisible();
  });

  test("ambiguous English schedule resolves with inline choices", async ({ page }) => {
    await submit(page, "Watch it next week or so");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "schedule_clarify");
    await expect(promise).toHaveAttribute("data-confidence", "medium");
    const choices = promise.getByTestId("promise-clarify-chips");
    await expect(choices).toBeVisible();
    await choices.getByRole("button").first().click();
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("task remains a later task without forcing a date", async ({ page }) => {
    await submit(page, "Call mom");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "task");
    await expect(promise.getByTestId("promise-primary")).toHaveText("Keep as later task");
    await expect(promise.getByTestId("promise-add-date")).toBeVisible();
    await promise.getByTestId("promise-primary").click();
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{ decision?: string }>;
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.decision).toBe("later");
  });

  test("sensitive reference notes are not auto-routed", async ({ page }) => {
    await submit(page, "Passport number");
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
  });

  test("Adjust opens manual scheduling and Escape returns to the card", async ({ page }) => {
    await submit(page, "Dentist tomorrow at 3pm");
    const promise = phone(page).getByTestId("inline-promise").last();
    await promise.getByTestId("promise-manual").click();
    await expect(page.getByRole("dialog").last()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(promise).toBeVisible();
  });
});

test.describe("Natural-language scheduling in Korean", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
    await page.reload();
  });

  test("명확한 일정은 한 번에 추가된다", async ({ page }) => {
    await submitKo(page, "내일 오후 3시에 치과");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "schedule_exact");
    await expect(promise).toHaveAttribute("data-needs-confirmation", "false");
    await expect(promise.getByTestId("promise-primary")).toHaveText("일정에 추가");
    await promise.getByTestId("promise-primary").click();
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("주말 표현은 토요일과 일요일 중 선택하게 한다", async ({ page }) => {
    await submitKo(page, "주말에 영화 보기");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-needs-confirmation", "true");
    const choices = promise.getByTestId("promise-confirmation-choices");
    await expect(choices).toBeVisible();
    await choices.getByRole("button").first().click();
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("애매한 날짜는 카드 안에서 해결한다", async ({ page }) => {
    await submitKo(page, "다음주쯤 보기");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "schedule_clarify");
    await promise
      .getByTestId("promise-clarify-chips")
      .getByRole("button")
      .first()
      .click();
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("날짜 없는 할 일은 나중 할 일로 둔다", async ({ page }) => {
    await submitKo(page, "엄마한테 전화하기");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute("data-intent", "task");
    await expect(promise.getByTestId("promise-primary")).toHaveText("나중 할 일로 두기");
    await promise.getByTestId("promise-primary").click();
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{ decision?: string }>;
    expect(inbox[0]?.decision).toBe("later");
  });

  test("할 일에서 날짜 추가를 누르면 수동 일정 화면이 열린다", async ({ page }) => {
    await submitKo(page, "엄마한테 전화하기");
    const promise = phone(page).getByTestId("inline-promise").last();
    await promise.getByTestId("promise-add-date").click();
    await expect(page.getByRole("dialog").last()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(promise).toBeVisible();
  });

  test("민감한 참고 정보는 자동 분류하지 않는다", async ({ page }) => {
    await submitKo(page, "여권 번호");
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
  });
});
