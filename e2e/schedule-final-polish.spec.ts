import { expect, test } from "@playwright/test";
import {
  GUEST_SCHEDULE_KEY,
  phone,
  resetAppState,
} from "./helpers";

test("multi-day range, schedule switches, and reminder metadata stay visually aligned", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAppState(page);

  const seeded = await page.evaluate(({ key }) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 4, 9, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 5, 17, 0, 0, 0);
    const alarm = new Date(start.getTime() - 30 * 60 * 1000);
    const text = `Two day visible plan ${Date.now()}`;
    localStorage.setItem(
      key,
      JSON.stringify([
        {
          id: "00000000-0000-4000-a000-000000000821",
          text,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          alarm: true,
          alarm_at: alarm.toISOString(),
          all_day: false,
          start_all_day: false,
          end_all_day: false,
          created_at: new Date().toISOString(),
          status: "active",
        },
      ]),
    );
    return { text };
  }, { key: GUEST_SCHEDULE_KEY });

  await page.reload();
  const frame = phone(page);
  await frame.getByRole("link", { name: /^Schedule/ }).click();
  await frame.getByRole("tab", { name: "Calendar" }).click();
  await frame.getByRole("button", { name: "Next month" }).click();

  const bar = frame
    .locator(".calendar-span-bar")
    .filter({ hasText: seeded.text })
    .first();
  await expect(bar).toBeVisible();

  const rangeGeometry = await page.evaluate((title) => {
    const start = document.querySelector<HTMLElement>('[data-cal-day="4"]');
    const end = document.querySelector<HTMLElement>('[data-cal-day="5"]');
    const bar = Array.from(
      document.querySelectorAll<HTMLElement>(".calendar-span-bar"),
    ).find((node) => node.textContent?.includes(title));
    if (!start || !end || !bar) return null;
    const startRect = start.getBoundingClientRect();
    const endRect = end.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    return {
      startLeft: startRect.left,
      endRight: endRect.right,
      barLeft: barRect.left,
      barRight: barRect.right,
      cellWidth: startRect.width,
      barWidth: barRect.width,
    };
  }, seeded.text);

  expect(rangeGeometry).not.toBeNull();
  expect(rangeGeometry!.barWidth).toBeGreaterThan(
    rangeGeometry!.cellWidth * 1.7,
  );
  expect(Math.abs(rangeGeometry!.barLeft - rangeGeometry!.startLeft)).toBeLessThan(10);
  expect(Math.abs(rangeGeometry!.barRight - rangeGeometry!.endRight)).toBeLessThan(10);

  await frame.getByRole("tab", { name: "Upcoming" }).click();
  const row = frame
    .locator('li[data-reminder="on"]')
    .filter({ hasText: seeded.text })
    .first();
  await expect(row).toBeVisible();
  const reminder = row.locator('button[aria-label*="Reminder on"]');
  await expect(reminder).toBeVisible();

  const reminderGeometry = await Promise.all([
    row.boundingBox(),
    reminder.boundingBox(),
  ]);
  expect(reminderGeometry[0]).not.toBeNull();
  expect(reminderGeometry[1]).not.toBeNull();
  expect(reminderGeometry[1]!.x).toBeGreaterThan(
    reminderGeometry[0]!.x + reminderGeometry[0]!.width * 0.5,
  );
  expect(reminderGeometry[1]!.x + reminderGeometry[1]!.width).toBeLessThanOrEqual(
    reminderGeometry[0]!.x + reminderGeometry[0]!.width + 1,
  );

  await row.click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Add time and end" }).click();

  const flow = page.getByTestId("schedule-manager-flow");
  const switches = flow.getByRole("switch", { name: "All-day" });
  await expect(switches).toHaveCount(2);

  for (let index = 0; index < 2; index += 1) {
    const toggle = switches.nth(index);
    const section = toggle.locator("xpath=ancestor::section[1]");
    const [toggleBox, sectionBox] = await Promise.all([
      toggle.boundingBox(),
      section.boundingBox(),
    ]);
    expect(toggleBox).not.toBeNull();
    expect(sectionBox).not.toBeNull();
    expect(Math.abs(toggleBox!.width - 51)).toBeLessThan(2);
    expect(Math.abs(toggleBox!.height - 31)).toBeLessThan(2);
    expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(
      sectionBox!.x + sectionBox!.width - 12,
    );
  }
});
