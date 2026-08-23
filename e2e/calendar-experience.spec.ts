import { expect, test, type Page } from "@playwright/test";
import { GUEST_SCHEDULE_KEY, resetAppState } from "./helpers";

async function seedCalendar(page: Page) {
  await page.evaluate(
    ({ key }) => {
      const now = new Date();
      const at = (day: number, hour: number, minute = 0) =>
        new Date(
          now.getFullYear(),
          now.getMonth(),
          day,
          hour,
          minute,
          0,
          0,
        ).toISOString();
      const today = now.getDate();
      const daysInMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      const spanStart = Math.min(Math.max(2, today - 2), daysInMonth - 3);

      localStorage.setItem(
        key,
        JSON.stringify([
          {
            id: "00000000-0000-4000-a000-000000000201",
            text: "Morning focus",
            start_time: at(today, 9),
            end_time: at(today, 10),
            alarm: false,
            created_at: new Date().toISOString(),
            status: "active",
          },
          {
            id: "00000000-0000-4000-a000-000000000202",
            text: "Lunch with Mina",
            start_time: at(today, 12, 30),
            end_time: at(today, 13, 30),
            alarm: false,
            created_at: new Date(Date.now() - 1000).toISOString(),
            status: "active",
          },
          {
            id: "00000000-0000-4000-a000-000000000203",
            text: "Send portfolio",
            start_time: at(today, 16),
            end_time: at(today, 17),
            alarm: true,
            created_at: new Date(Date.now() - 2000).toISOString(),
            status: "active",
          },
          {
            id: "00000000-0000-4000-a000-000000000204",
            text: "Design sprint",
            start_time: at(spanStart, 9),
            end_time: at(spanStart + 2, 18),
            alarm: false,
            created_at: new Date(Date.now() - 3000).toISOString(),
            status: "active",
          },
        ]),
      );
    },
    { key: GUEST_SCHEDULE_KEY },
  );
}

async function openCalendar(page: Page) {
  await page.reload();
  await page.getByRole("link", { name: /^Schedule/ }).click();
  await page.getByRole("tab", { name: "Calendar" }).click();
  await expect(page.getByTestId("calendar-experience")).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    route: document.getElementById("phone-scroll")?.scrollWidth ?? 0,
    routeClient: document.getElementById("phone-scroll")?.clientWidth ?? 0,
  }));
  expect(overflow.document - overflow.viewport).toBeLessThanOrEqual(1);
  expect(overflow.body - overflow.viewport).toBeLessThanOrEqual(1);
  expect(overflow.route - overflow.routeClient).toBeLessThanOrEqual(1);
}

test("mobile calendar gives a clear month overview and selected-day agenda", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetAppState(page);
  await seedCalendar(page);
  await openCalendar(page);

  const today = await page.evaluate(() => new Date().getDate());
  const todayCell = page.locator(`[data-cal-day="${today}"]`);
  await expect(todayCell).toHaveAttribute("data-has-events", "true");
  await expect(todayCell.locator(".calendar-day-dots")).toBeVisible();
  await expect(todayCell.locator(".calendar-day-dots > span")).toHaveCount(3);
  await expect(todayCell.locator(".calendar-day-preview-row")).toBeHidden();

  await todayCell.click();
  const agenda = page
    .getByTestId("calendar-experience")
    .locator(":scope > div > div:nth-of-type(2) ul");
  await expect(agenda.getByText("Morning focus", { exact: true })).toBeVisible();
  await expect(agenda.getByText("Lunch with Mina", { exact: true })).toBeVisible();
  await expect(agenda.getByText("Send portfolio", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add on this day" }),
  ).toBeVisible();
  await expect(
    page.locator(".calendar-span-bar").filter({ hasText: "Design sprint" }).first(),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("desktop calendar reveals event titles and keeps the agenda beside the month", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await resetAppState(page);
  await seedCalendar(page);
  await openCalendar(page);

  const today = await page.evaluate(() => new Date().getDate());
  const todayCell = page.locator(`[data-cal-day="${today}"]`);
  await expect(todayCell.locator(".calendar-day-preview")).toHaveText(
    "Morning focus",
  );
  await expect(todayCell.locator(".calendar-day-preview")).toBeVisible();
  await expect(todayCell.locator(".calendar-day-more")).toHaveText("+2");

  const geometry = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(
      "[data-testid='calendar-experience'] > div",
    );
    const month = shell?.querySelector<HTMLElement>(":scope > div:first-child");
    const agenda = shell?.querySelector<HTMLElement>(
      ":scope > div:nth-of-type(2)",
    );
    if (!shell || !month || !agenda) throw new Error("calendar layout missing");
    const monthRect = month.getBoundingClientRect();
    const agendaRect = agenda.getBoundingClientRect();
    return {
      display: getComputedStyle(shell).display,
      monthRight: monthRect.right,
      agendaLeft: agendaRect.left,
      agendaWidth: agendaRect.width,
    };
  });

  expect(geometry.display).toBe("grid");
  expect(geometry.agendaLeft).toBeGreaterThan(geometry.monthRight);
  expect(geometry.agendaWidth).toBeGreaterThan(280);
  await expectNoHorizontalOverflow(page);
});
