import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  GUEST_SCHEDULE_KEY,
  phone,
  resetAppState,
} from "./helpers";

async function dragCenterTo(
  page: Page,
  source: Locator,
  target: Locator,
) {
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  const [sourceBox, targetBox] = await Promise.all([
    source.boundingBox(),
    target.boundingBox(),
  ]);
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  const fromX = sourceBox!.x + sourceBox!.width / 2;
  const fromY = sourceBox!.y + sourceBox!.height / 2;
  const toX = targetBox!.x + targetBox!.width / 2;
  const toY = targetBox!.y + targetBox!.height / 2;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 20 });
  await page.mouse.up();
}

async function readSchedule(page: Page, id: string) {
  return page.evaluate(
    ({ key, id }) => {
      const rows = JSON.parse(localStorage.getItem(key) || "[]") as Array<{
        id: string;
        start_time: string;
        end_time: string;
      }>;
      const row = rows.find((item) => item.id === id);
      if (!row) return null;
      const start = new Date(row.start_time);
      const end = new Date(row.end_time);
      return {
        startDay: start.getDate(),
        startHour: start.getHours(),
        startMinute: start.getMinutes(),
        endDay: end.getDate(),
        endHour: end.getHours(),
        endMinute: end.getMinutes(),
      };
    },
    { key: GUEST_SCHEDULE_KEY, id },
  );
}

test("calendar moves schedules and resizes multi-day ranges directly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await resetAppState(page);

  const seeded = await page.evaluate(({ key }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const at = (
      day: number,
      hour: number,
      minute: number,
      second = 0,
      millisecond = 0,
    ) => new Date(year, month, day, hour, minute, second, millisecond);

    const singleId = "00000000-0000-4000-a000-000000000901";
    const rangeId = "00000000-0000-4000-a000-000000000902";
    localStorage.setItem(
      key,
      JSON.stringify([
        {
          id: singleId,
          text: "Move one day",
          start_time: at(4, 14, 20).toISOString(),
          end_time: at(4, 15, 20).toISOString(),
          alarm: false,
          all_day: false,
          start_all_day: false,
          end_all_day: false,
          created_at: new Date().toISOString(),
          status: "active",
        },
        {
          id: rangeId,
          text: "Three day trip",
          start_time: at(8, 0, 0).toISOString(),
          end_time: at(10, 23, 59, 59, 999).toISOString(),
          alarm: false,
          all_day: true,
          start_all_day: true,
          end_all_day: true,
          created_at: new Date(Date.now() - 1000).toISOString(),
          status: "active",
        },
      ]),
    );

    return { singleId, rangeId };
  }, { key: GUEST_SCHEDULE_KEY });

  await page.reload();
  const frame = phone(page);
  await frame.getByRole("link", { name: /^Schedule/ }).click();
  await frame.getByRole("tab", { name: "Calendar" }).click();
  await frame.getByRole("button", { name: "Next month" }).click();
  await expect(frame.getByTestId("calendar-experience")).toBeVisible();

  const singlePreview = frame
    .locator(".calendar-day-preview")
    .filter({ hasText: "Move one day" });
  await expect(singlePreview).toHaveCSS("pointer-events", "auto");
  await dragCenterTo(
    page,
    singlePreview,
    frame.locator('[data-cal-day="5"]'),
  );

  await expect
    .poll(() => readSchedule(page, seeded.singleId))
    .toMatchObject({
      startDay: 5,
      startHour: 14,
      startMinute: 20,
      endDay: 5,
      endHour: 15,
      endMinute: 20,
    });

  let rangeBar = frame
    .locator(".calendar-span-bar")
    .filter({ hasText: "Three day trip" })
    .first();
  await dragCenterTo(
    page,
    rangeBar,
    frame.locator('[data-cal-day="15"]'),
  );

  await expect
    .poll(() => readSchedule(page, seeded.rangeId))
    .toMatchObject({
      startDay: 15,
      startHour: 0,
      startMinute: 0,
      endDay: 17,
      endHour: 23,
      endMinute: 59,
    });

  rangeBar = frame
    .locator(".calendar-span-bar")
    .filter({ hasText: "Three day trip" })
    .first();
  const startHandle = rangeBar.getByTestId("calendar-resize-start");
  await dragCenterTo(
    page,
    startHandle,
    frame.locator('[data-cal-day="16"]'),
  );

  await expect
    .poll(() => readSchedule(page, seeded.rangeId))
    .toMatchObject({
      startDay: 16,
      startHour: 0,
      startMinute: 0,
      endDay: 17,
      endHour: 23,
      endMinute: 59,
    });

  const endHandle = frame.getByTestId("calendar-resize-end").first();
  await dragCenterTo(
    page,
    endHandle,
    frame.locator('[data-cal-day="19"]'),
  );

  await expect
    .poll(() => readSchedule(page, seeded.rangeId))
    .toMatchObject({
      startDay: 16,
      startHour: 0,
      startMinute: 0,
      endDay: 19,
      endHour: 23,
      endMinute: 59,
    });
});
