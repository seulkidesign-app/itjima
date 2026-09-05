import { expect, test } from "@playwright/test";
import {
  GUEST_INBOX_KEY,
  phone,
  resetAppState,
} from "./helpers";

test("mobile capture keeps the composer directly above bottom navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAppState(page);

  await page.evaluate(({ key }) => {
    localStorage.setItem(
      key,
      JSON.stringify([
        {
          id: "00000000-0000-4000-a000-000000000711",
          text: "A thought near the bottom",
          images: [],
          created_at: new Date().toISOString(),
        },
      ]),
    );
  }, { key: GUEST_INBOX_KEY });
  await page.reload();

  const frame = phone(page);
  const chat = frame.locator(".home-chat-lane");
  const composer = frame
    .locator(".page-shell > div:first-child > div.composer-hero")
    .first();
  const nav = frame.locator(".mobile-bottom-nav");

  await expect(chat).toBeVisible();
  await expect(composer).toBeVisible();
  await expect(nav).toBeVisible();

  const geometry = await page.evaluate(() => {
    const chat = document.querySelector<HTMLElement>(".home-chat-lane");
    const composer = document.querySelector<HTMLElement>(
      ".page-shell > div:first-child > div.composer-hero",
    );
    const nav = document.querySelector<HTMLElement>(".mobile-bottom-nav");
    if (!chat || !composer || !nav) return null;
    const chatRect = chat.getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    return {
      chatBottom: chatRect.bottom,
      composerTop: composerRect.top,
      composerBottom: composerRect.bottom,
      navTop: navRect.top,
      chatOverflowY: getComputedStyle(chat).overflowY,
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry!.chatBottom).toBeLessThanOrEqual(geometry!.composerTop + 2);
  expect(geometry!.composerBottom).toBeLessThanOrEqual(geometry!.navTop + 2);
  expect(geometry!.navTop - geometry!.composerBottom).toBeLessThan(24);
  expect(geometry!.chatOverflowY).toMatch(/auto|scroll/);
});

test("mobile capture keeps identical dock geometry before and after focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAppState(page);
  await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
  await page.reload();

  const frame = phone(page);
  const input = frame.locator("#capture-input");
  const shell = frame.locator("form.composer-hero .input-shell");
  const nav = frame.locator(".mobile-bottom-nav");
  const attachment = frame.getByRole("button", { name: "첨부 도구" });
  const mic = frame.getByRole("button", { name: "음성 입력" });
  const submit = frame.getByTestId("capture-submit");

  await expect(input).toBeVisible();
  await expect(shell).toBeVisible();
  await expect(nav).toBeVisible();
  await expect(attachment).toBeVisible();
  await expect(mic).toBeVisible();
  await expect(submit).toBeVisible();

  const geometry = async () => {
    const shellBox = await shell.boundingBox();
    const navBox = await nav.boundingBox();
    if (!shellBox || !navBox) throw new Error("composer geometry unavailable");
    return {
      shellX: shellBox.x,
      shellRight: shellBox.x + shellBox.width,
      shellHeight: shellBox.height,
      navX: navBox.x,
      navRight: navBox.x + navBox.width,
      gap: navBox.y - (shellBox.y + shellBox.height),
    };
  };

  const idle = await geometry();
  expect(Math.abs(idle.shellX - idle.navX)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(idle.shellRight - idle.navRight)).toBeLessThanOrEqual(1.5);
  expect(idle.gap).toBeGreaterThanOrEqual(7);
  expect(idle.gap).toBeLessThanOrEqual(14);

  const attachmentBox = await attachment.boundingBox();
  const micBox = await mic.boundingBox();
  expect(attachmentBox).not.toBeNull();
  expect(micBox).not.toBeNull();
  expect(attachmentBox!.width).toBeGreaterThanOrEqual(44);
  expect(attachmentBox!.height).toBeGreaterThanOrEqual(44);
  expect(micBox!.width).toBeGreaterThanOrEqual(44);
  expect(micBox!.height).toBeGreaterThanOrEqual(44);

  await input.focus();
  await expect(input).toBeFocused();
  await expect(shell).toHaveCSS("border-color", "rgb(255, 224, 51)");
  const focused = await geometry();
  expect(Math.abs(focused.shellX - idle.shellX)).toBeLessThanOrEqual(1);
  expect(Math.abs(focused.shellRight - idle.shellRight)).toBeLessThanOrEqual(1);
  expect(Math.abs(focused.shellHeight - idle.shellHeight)).toBeLessThanOrEqual(2);
  expect(Math.abs(focused.gap - idle.gap)).toBeLessThanOrEqual(2);

  // Simulate the viewport shrinking when a mobile keyboard opens. The composer
  // and persistent nav must keep moving as one dock rather than separating.
  await page.setViewportSize({ width: 390, height: 620 });
  const keyboardSized = await geometry();
  expect(keyboardSized.gap).toBeGreaterThanOrEqual(7);
  expect(keyboardSized.gap).toBeLessThanOrEqual(14);
});

for (const viewport of [
  { name: "320px", width: 320, height: 568 },
  { name: "390px", width: 390, height: 844 },
  { name: "430px", width: 430, height: 932 },
]) {
  test(`mobile capture aligns input and navigation at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await resetAppState(page);
    await page.evaluate(() => localStorage.setItem("itjima_lang", "ko"));
    await page.reload();

    const frame = phone(page);
    const shell = frame.locator("form.composer-hero .input-shell");
    const nav = frame.locator(".mobile-bottom-nav");
    const input = frame.locator("#capture-input");
    await expect(shell).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(input).toHaveAttribute("placeholder", "생각나는 대로 적어봐요");

    const shellBox = await shell.boundingBox();
    const navBox = await nav.boundingBox();
    expect(shellBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(Math.abs(shellBox!.x - navBox!.x)).toBeLessThanOrEqual(1.5);
    expect(
      Math.abs(
        shellBox!.x + shellBox!.width - (navBox!.x + navBox!.width),
      ),
    ).toBeLessThanOrEqual(1.5);

    const inputMetrics = await input.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(inputMetrics.scrollHeight - inputMetrics.clientHeight).toBeLessThanOrEqual(2);
  });
}

test("capture scheduling always shows start and end dates and time switches reveal time fields", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAppState(page);

  const id = "00000000-0000-4000-a000-000000000712";
  const text = "고민 중";
  await page.evaluate(
    ({ key, id, text }) => {
      localStorage.setItem("itjima_lang", "ko");
      localStorage.setItem(
        key,
        JSON.stringify([
          {
            id,
            text,
            images: [],
            created_at: new Date().toISOString(),
          },
        ]),
      );
      localStorage.setItem("itjima.nl.acknowledged.guest", JSON.stringify([id]));
    },
    { key: GUEST_INBOX_KEY, id, text },
  );
  await page.reload();

  const frame = phone(page);
  await frame
    .getByRole("paragraph")
    .filter({ hasText: text })
    .first()
    .click();

  const detail = page.getByRole("dialog", { name: /기록 상세|이 생각/ });
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: /날짜\/시간 추가|일정으로 보내기|Add date\/time|Send to schedule/ }).click();

  const flow = page.getByTestId("schedule-choice-flow");
  await expect(flow).toBeVisible();
  await flow.getByRole("button", { name: /선택$/ }).click();

  const startDate = flow.locator('input[type="date"][aria-label="시작 날짜"]');
  const endDate = flow.locator('input[type="date"][aria-label="종료 날짜"]');
  const startTime = flow.locator('input[type="time"][aria-label="시작 시간"]');
  const endTime = flow.locator('input[type="time"][aria-label="종료 시간"]');
  const startSwitch = flow.getByRole("switch", {
    name: "시작 시간 설정",
    exact: true,
  });
  const endSwitch = flow.getByRole("switch", {
    name: "종료 시간 설정",
    exact: true,
  });

  await expect(startDate).toBeVisible();
  await expect(endDate).toBeVisible();
  await expect(startSwitch).toBeVisible();
  await expect(endSwitch).toBeVisible();
  await expect(startSwitch).toHaveAttribute("aria-checked", "true");
  await expect(endSwitch).toHaveAttribute("aria-checked", "true");
  await expect(startTime).toBeVisible();
  await expect(endTime).toBeVisible();

  await startSwitch.click();
  await expect(startSwitch).toHaveAttribute("aria-checked", "false");
  await expect(startTime).toHaveCount(0);
  await expect(startDate).toBeVisible();

  await startSwitch.click();
  await expect(startTime).toBeVisible();

  const startBox = await startSwitch.boundingBox();
  const endBox = await endSwitch.boundingBox();
  const flowBox = await flow.boundingBox();
  expect(startBox).not.toBeNull();
  expect(endBox).not.toBeNull();
  expect(flowBox).not.toBeNull();
  expect(startBox!.x + startBox!.width).toBeLessThanOrEqual(
    flowBox!.x + flowBox!.width - 12,
  );
  expect(endBox!.x + endBox!.width).toBeLessThanOrEqual(
    flowBox!.x + flowBox!.width - 12,
  );
});
