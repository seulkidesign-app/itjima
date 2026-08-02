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

  const id = "00000000-0000-4000-a000-000000000712";
  const text = `Thinking about this ${Date.now()}`;
  await page.evaluate(
    ({ key, id, text }) => {
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

  const detail = page.getByRole("dialog", { name: "This thought" });
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "Send to schedule" }).click();

  const flow = page.getByTestId("schedule-choice-flow");
  await expect(flow).toBeVisible();
  await flow.getByRole("button", { name: /selected$/ }).click();

  const startDate = flow.getByLabel("Start date");
  const endDate = flow.getByLabel("End date");
  const startSwitch = flow.getByRole("switch", { name: "Set start time" });
  const endSwitch = flow.getByRole("switch", { name: "Set end time" });

  await expect(startDate).toBeVisible();
  await expect(endDate).toBeVisible();
  await expect(startSwitch).toBeVisible();
  await expect(endSwitch).toBeVisible();
  await expect(startSwitch).toHaveAttribute("aria-checked", "true");
  await expect(endSwitch).toHaveAttribute("aria-checked", "true");
  await expect(flow.getByLabel("Start time")).toBeVisible();
  await expect(flow.getByLabel("End time")).toBeVisible();

  await startSwitch.click();
  await expect(startSwitch).toHaveAttribute("aria-checked", "false");
  await expect(flow.getByLabel("Start time")).toHaveCount(0);
  await expect(startDate).toBeVisible();

  await startSwitch.click();
  await expect(flow.getByLabel("Start time")).toBeVisible();

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
