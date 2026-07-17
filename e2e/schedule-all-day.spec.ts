import { test, expect, type Page } from "@playwright/test";
import {
  readGuestList,
  GUEST_SCHEDULE_KEY,
} from "./helpers";

async function resetForScheduleAllDay(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("itjima.")) localStorage.removeItem(k);
    }
    localStorage.setItem("itjima_lang", "en");
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole("link", { name: /^When/ }).waitFor({ state: "visible" });
}

function app(page: Page) {
  const frame = page.locator(".phone-frame");
  return frame.count().then((n) => (n > 0 ? frame : page));
}

type SeedSchedule = {
  id: string;
  text: string;
  start_time: string;
  end_time: string;
  alarm: boolean;
  created_at: string;
  all_day?: boolean;
  start_all_day?: boolean;
  end_all_day?: boolean;
  status: "active";
};

async function seedSchedule(page: import("@playwright/test").Page, item: SeedSchedule) {
  await page.evaluate(
    ({ key, schedule }) => {
      localStorage.setItem(key, JSON.stringify([schedule]));
    },
    { key: GUEST_SCHEDULE_KEY, schedule: item },
  );
}

function tomorrowParts() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    y: tomorrow.getFullYear(),
    m: tomorrow.getMonth(),
    d: tomorrow.getDate(),
  };
}

async function openEditTimeStep(page: Page, title: string) {
  const ui = await app(page);
  await ui.getByRole("link", { name: /^When/ }).click();
  await ui.getByRole("tab", { name: "Flow" }).click();
  await ui
    .getByRole("button", { name: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`) })
    .click();
  await ui.getByRole("button", { name: "Next", exact: true }).click();
  await ui.getByRole("button", { name: "Next", exact: true }).click();
}

test.describe("Schedule start/end all-day flags (QA #7)", () => {
  test.beforeEach(async ({ page }) => {
    await resetForScheduleAllDay(page);
  });

  test("persists start_all_day=true and end_all_day=false after refresh", async ({
    page,
  }) => {
    const id = `qa7-${Date.now()}`;
    const { y, m, d } = tomorrowParts();
    await seedSchedule(page, {
      id,
      text: "Mixed all-day QA",
      start_time: new Date(y, m, d, 0, 0, 0, 0).toISOString(),
      end_time: new Date(y, m, d, 14, 0, 0, 0).toISOString(),
      alarm: false,
      created_at: new Date().toISOString(),
      all_day: false,
      start_all_day: true,
      end_all_day: false,
      status: "active",
    });

    await page.reload();
    const ui = await app(page);
    await ui.getByRole("link", { name: /^When/ }).click();

    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    expect(schedules.length).toBe(1);
    const saved = schedules[0] as SeedSchedule;
    expect(saved.start_all_day).toBe(true);
    expect(saved.end_all_day).toBe(false);
    expect(saved.all_day).toBe(false);
  });

  test("edit screen keeps toggle states from stored flags", async ({ page }) => {
    const id = `qa7-edit-${Date.now()}`;
    const { y, m, d } = tomorrowParts();
    await seedSchedule(page, {
      id,
      text: "Mixed all-day edit",
      start_time: new Date(y, m, d, 0, 0, 0, 0).toISOString(),
      end_time: new Date(y, m, d, 14, 0, 0, 0).toISOString(),
      alarm: false,
      created_at: new Date().toISOString(),
      all_day: false,
      start_all_day: true,
      end_all_day: false,
      status: "active",
    });

    await page.reload();
    await openEditTimeStep(page, "Mixed all-day edit");

    const ui = await app(page);
    const switches = ui.getByRole("switch", { name: "All-day" });
    await expect(switches.nth(0)).toHaveAttribute("aria-checked", "true");
    await expect(switches.nth(1)).toHaveAttribute("aria-checked", "false");
  });

  test("00:00 timed schedule with explicit false is not treated as all-day", async ({
    page,
  }) => {
    const id = `qa7-midnight-${Date.now()}`;
    const { y, m, d } = tomorrowParts();
    await seedSchedule(page, {
      id,
      text: "Midnight timed",
      start_time: new Date(y, m, d, 0, 0, 0, 0).toISOString(),
      end_time: new Date(y, m, d, 1, 0, 0, 0).toISOString(),
      alarm: false,
      created_at: new Date().toISOString(),
      all_day: false,
      start_all_day: false,
      end_all_day: false,
      status: "active",
    });

    await page.reload();
    await openEditTimeStep(page, "Midnight timed");

    const ui = await app(page);
    const switches = ui.getByRole("switch", { name: "All-day" });
    await expect(switches.nth(0)).toHaveAttribute("aria-checked", "false");
    await expect(switches.nth(1)).toHaveAttribute("aria-checked", "false");
  });

  test("legacy all_day=true without new fields resolves as both all-day", async ({
    page,
  }) => {
    const id = `qa7-legacy-${Date.now()}`;
    const { y, m, d } = tomorrowParts();
    await seedSchedule(page, {
      id,
      text: "Legacy all day",
      start_time: new Date(y, m, d, 0, 0, 0, 0).toISOString(),
      end_time: new Date(y, m, d, 23, 59, 0, 0).toISOString(),
      alarm: false,
      created_at: new Date().toISOString(),
      all_day: true,
      status: "active",
    });

    await page.reload();
    await openEditTimeStep(page, "Legacy all day");

    const ui = await app(page);
    const switches = ui.getByRole("switch", { name: "All-day" });
    await expect(switches.nth(0)).toHaveAttribute("aria-checked", "true");
    await expect(switches.nth(1)).toHaveAttribute("aria-checked", "true");
  });

  test("creates schedule with start all-day and end timed via When FAB", async ({
    page,
  }) => {
    const ui = await app(page);
    await ui.getByRole("link", { name: /^When/ }).click();
    await ui
      .getByRole("button", { name: "Remember something new" })
      .click();
    await ui.getByPlaceholder("What to remember").waitFor({ state: "visible" });

    const text = `Start all-day ${Date.now()}`;
    await ui.getByPlaceholder("What to remember").fill(text);
    await ui.getByRole("button", { name: "Next", exact: true }).click();

    const switches = ui.getByRole("switch", { name: "All-day" });
    await switches.nth(0).click();

    await ui.getByRole("button", { name: "Next", exact: true }).click();
    await ui.getByRole("button", { name: /Keep it/ }).click();

    await page.reload();
    const schedules = (await readGuestList(
      page,
      GUEST_SCHEDULE_KEY,
    )) as SeedSchedule[];
    const saved = schedules.find((s) => s.text === text);
    expect(saved).toBeTruthy();
    expect(saved!.start_all_day).toBe(true);
    expect(saved!.end_all_day).toBe(false);
    expect(saved!.all_day).toBe(false);
  });
});
