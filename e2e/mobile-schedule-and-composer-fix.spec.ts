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

test("capture scheduling always shows start and end dates and time switches reveal time fields", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAppState(page);

  const text = `Thinking about this ${Date.now()}`;
  await page.evaluate(
    ({ key, text }) => {
      localStorage.setItem(
        key,
        JSON.stringify([
          {
            id: "00000000-0000-4000-a000-000000000712",
            text,
            images: [],
            created_at: new Date().toISOString(),
          },
        ]),
      );
    },
    { key: GUEST_INBOX_KEY, text },
  );
  await page.reload();

  const frame = phone(page);
  await frame
    .getByRole("paragraph")
    .filter({ hasText: text })
    .first()
    .click();

  const detail = page.getByRole("dialog", { name: "This thought" });
  await detail.getByRole("button", { name: "Send to schedule" }).click();

  const sheet = page.getByRole("dialog").last();
  await sheet.getByRole("button", { name: /selected$/ }).click();

  const startDate = sheet.getByLabel("Start date");
  const endDate = sheet.getByLabel("End date");
  const startSwitch = sheet.getByRole("switch", { name: "Set start time" });
  const endSwitch = sheet.getByRole("switch", { name: "Set end time" });

  await expect(startDate).toBeVisible();
  await expect(endDate).toBeVisible();
  await expect(startSwitch).toBeVisible();
  await expect(endSwitch).toBeVisible();
  await expect(startSwitch).toHaveAttribute("aria-checked", "true");
  await expect(endSwitch).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByLabel("Start time")).toBeVisible();
  await expect(sheet.getByLabel("End time")).toBeVisible();

  await startSwitch.click();
  await expect(startSwitch).toHaveAttribute("aria-checked", "false");
  await expect(sheet.getByLabel("Start time")).toHaveCount(0);
  await expect(startDate).toBeVisible();

  await startSwitch.click();
  await expect(sheet.getByLabel("Start time")).toBeVisible();

  const startBox = await startSwitch.boundingBox();
  const endBox = await endSwitch.boundingBox();
  const dialogBox = await sheet.boundingBox();
  expect(startBox).not.toBeNull();
  expect(endBox).not.toBeNull();
  expect(dialogBox).not.toBeNull();
  expect(startBox!.x + startBox!.width).toBeLessThanOrEqual(
    dialogBox!.x + dialogBox!.width - 12,
  );
  expect(endBox!.x + endBox!.width).toBeLessThanOrEqual(
    dialogBox!.x + dialogBox!.width - 12,
  );
});
