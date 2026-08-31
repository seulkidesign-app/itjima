import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
} from "./helpers";

async function submit(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.locator('form.composer-hero button[type="submit"]').click();
}

async function submitKo(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.getByRole("button", { name: "남기기", exact: true }).click();
}

test.describe("Natural-language scheduling", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("clear English schedule auto-commits on capture", async ({ page }) => {
    await submit(page, "Dentist tomorrow at 3pm");
    await expect(
      phone(page).getByTestId("saved-schedule-feedback"),
    ).toBeVisible();
    await expect(phone(page).getByTestId("commitment-confirm")).toHaveCount(0);
    await expect(phone(page).getByTestId("promise-primary")).toHaveCount(0);
    // M1: canonical inbox record is kept; schedule is a derived projection.
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      temporal_state?: string;
      start_time?: string;
    }>;
    expect(inbox.length).toBe(1);
    expect(inbox[0]?.temporal_state).toBe("exact_datetime");
    expect(inbox[0]?.start_time).toBeTruthy();
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<{
      text?: string;
      id?: string;
      source_id?: string;
    }>;
    expect(schedules[0]?.text ?? "").toMatch(/Dentist/i);
    expect(schedules[0]?.id || schedules[0]?.source_id).toBeTruthy();
  });

  test("ambiguous English schedule resolves with inline choices", async ({ page }) => {
    await submit(page, "Watch it next week or so");
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toBeVisible();
    await expect(promise).toContainText("Watch it next week or so");
    await expect(promise).toHaveAttribute("data-intent", "schedule_clarify");
    await expect(promise).toHaveAttribute("data-confidence", "medium");
    const choices = promise.getByTestId("promise-clarify-chips");
    await expect(choices).toBeVisible();
    await choices.getByRole("button").first().click();
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("undated note saves without task taxonomy confirmation", async ({ page }) => {
    await submit(page, "Call mom");
    await expect(
      phone(page).getByText("Call mom", { exact: true }).first(),
    ).toBeVisible();
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      decision?: string;
      text?: string;
    }>;
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.text).toBe("Call mom");
    expect(inbox[0]?.decision).toBeUndefined();
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(0);
  });

  test("sensitive reference notes are not auto-routed", async ({ page }) => {
    await submit(page, "Passport number");
    await expect(
      phone(page).getByText("Passport number", { exact: true }).first(),
    ).toBeVisible();
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
  });
});

test.describe("Natural-language scheduling in Korean", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
    await page.reload();
  });

  test("명확한 일정은 남기기 한 번에 저장된다", async ({ page }) => {
    await submitKo(page, "내일 오후 3시 반 치과");
    await expect(
      phone(page).getByTestId("saved-schedule-feedback"),
    ).toBeVisible();
    await expect(phone(page).getByTestId("commitment-confirm")).toHaveCount(0);
    await expect(phone(page).getByTestId("promise-primary")).toHaveCount(0);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
    // M1: record kept with temporal metadata.
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      temporal_state?: string;
    }>;
    expect(inbox.length).toBe(1);
    expect(inbox[0]?.temporal_state).toBe("exact_datetime");
  });

  test("오전/오후가 애매하면 선택 후 바로 일정 생성", async ({ page }) => {
    await submitKo(page, "내일 3시 반 치과");
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(0);
    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(1);

    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute(
      "data-confirmation-reason",
      "assumed_meridiem",
    );
    await promise.getByTestId("promise-confirm-afternoon").click();
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
    await expect(
      phone(page).getByTestId("saved-schedule-feedback"),
    ).toBeVisible();
  });

  test("bare clock without date still asks AM/PM and never auto-schedules", async ({
    page,
  }) => {
    await submitKo(page, "8시에 운동");
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(0);
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      text?: string;
      start_time?: string | null;
      temporal_state?: string;
    }>;
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.text).toContain("8시에 운동");
    expect(inbox[0]?.start_time).toBeFalsy();

    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toBeVisible();
    await expect(promise).toHaveAttribute(
      "data-confirmation-reason",
      "assumed_meridiem",
    );
    await expect(promise).toContainText("8시는 언제인가요?");
    await expect(promise.getByTestId("promise-confirm-morning")).toBeVisible();
    await expect(promise.getByTestId("promise-confirm-afternoon")).toBeVisible();

    await promise.getByTestId("promise-confirm-afternoon").click();
    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<{
      text?: string;
      start_time?: string;
    }>;
    expect(schedules).toHaveLength(1);
    expect(schedules[0]?.text).toMatch(/운동/);
    // Playwright runs with timezoneId America/New_York (see playwright.config).
    const hourInAppTz = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(new Date(schedules[0]!.start_time!)),
    );
    expect(hourInAppTz % 24).toBe(20);
  });

  test("spoken bare clock gets the same AM/PM clarification; noun collisions stay quiet", async ({
    page,
  }) => {
    await submitKo(page, "두 시안 비교");
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);

    await submitKo(page, "두 시 회의");
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(0);
    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toBeVisible();
    await expect(promise).toHaveAttribute(
      "data-confirmation-reason",
      "assumed_meridiem",
    );
    await expect(promise).toContainText("2시는 언제인가요?");
    await promise.getByTestId("promise-confirm-afternoon").click();
    const schedules = (await readGuestList(page, GUEST_SCHEDULE_KEY)) as Array<{
      text?: string;
      start_time?: string;
    }>;
    expect(schedules).toHaveLength(1);
    const hourInAppTz = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(new Date(schedules[0]!.start_time!)),
    );
    expect(hourInAppTz % 24).toBe(14);
  });

  test("시간이 두 개면 일정 생성 없이 입력 수정으로 복원한다", async ({ page }) => {
    await submitKo(page, "오늘 3시 A, 6시 B");
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);

    const promise = phone(page).getByTestId("inline-promise").last();
    await expect(promise).toHaveAttribute(
      "data-confirmation-reason",
      "multiple_clocks",
    );
    await expect(promise.getByTestId("promise-edit-input")).toBeVisible();
    await promise.getByTestId("promise-edit-input").click();
    await expect(phone(page).locator("#capture-input")).toHaveValue(
      "오늘 3시 A, 6시 B",
    );
    // Raw must still be durable until the user replaces it.
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
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
    await expect(promise).toBeVisible();
    await expect(promise).toContainText("다음주쯤 보기");
    await expect(promise).toHaveAttribute("data-intent", "schedule_clarify");
    await promise
      .getByTestId("promise-clarify-chips")
      .getByRole("button")
      .first()
      .click();
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(1);
  });

  test("날짜 없는 메모는 분류 없이 남겨둔다", async ({ page }) => {
    await submitKo(page, "에어팟 소독");
    await expect(
      phone(page).getByText("에어팟 소독", { exact: true }).first(),
    ).toBeVisible();
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    const inbox = (await readGuestList(page, GUEST_INBOX_KEY)) as Array<{
      text?: string;
      decision?: string;
    }>;
    expect(inbox[0]?.text).toBe("에어팟 소독");
    expect(inbox[0]?.decision).toBeUndefined();
    expect((await readGuestList(page, GUEST_SCHEDULE_KEY)).length).toBe(0);
  });

  test("민감한 참고 정보는 자동 분류하지 않는다", async ({ page }) => {
    await submitKo(page, "여권 번호");
    await expect(phone(page).getByTestId("inline-promise")).toHaveCount(0);
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(1);
  });
});
