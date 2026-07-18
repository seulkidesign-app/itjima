import { test, expect, type Page } from "@playwright/test";
import { readGuestList, GUEST_SCHEDULE_KEY, TEST_USER_ID } from "./helpers";
import {
  resolveScheduleAllDayFlags,
  scheduleAllDayFieldsFromConfirm,
} from "../src/lib/scheduleTime";

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

function isoAt(y: number, m: number, d: number, h: number, min = 0) {
  return new Date(y, m, d, h, min, 0, 0).toISOString();
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

function todayParts() {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
}

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
  await page.getByRole("link", { name: /^Thoughts/ }).waitFor({ state: "visible" });
  const closeButtons = page.getByRole("button", { name: "Close" });
  if (await closeButtons.count()) {
    await closeButtons.first().click();
  }
}

function app(page: Page) {
  const frame = page.locator(".phone-frame");
  return frame.count().then((n) => (n > 0 ? frame : page));
}

async function seedSchedule(page: Page, item: SeedSchedule) {
  await page.evaluate(
    ({ key, schedule }) => {
      localStorage.setItem(key, JSON.stringify([schedule]));
    },
    { key: GUEST_SCHEDULE_KEY, schedule: item },
  );
}

async function readGuestSchedule(page: Page): Promise<SeedSchedule[]> {
  return (await readGuestList(page, GUEST_SCHEDULE_KEY)) as SeedSchedule[];
}

async function openEditTimeStep(
  page: Page,
  title: string,
  opts?: { upcoming?: boolean },
) {
  const ui = await app(page);
  await ui.getByRole("link", { name: /^Tasks/ }).click();
  if (opts?.upcoming) {
    await ui.getByRole("tab", { name: "Upcoming" }).click();
  }
  await ui
    .getByRole("button", {
      name: new RegExp(
        `^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`,
      ),
    })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Pick a time" }).click();
  await page
    .getByRole("dialog")
    .getByRole("switch", { name: "All-day" })
    .first()
    .waitFor({ state: "visible" });
}

async function openCreateTimeStep(
  page: Page,
  opts?: { tomorrow?: boolean; title?: string },
) {
  const ui = await app(page);
  await ui.getByRole("link", { name: /^Tasks/ }).click();
  await ui.getByRole("button", { name: "Add task" }).click();
  const sheet = page.getByRole("dialog");
  if (opts?.tomorrow) {
    await sheet.getByRole("button", { name: "Tomorrow" }).click();
  }
  await sheet.getByRole("button", { name: "Pick a time" }).click();
  if (opts?.title) {
    await sheet.getByPlaceholder("What to remember").fill(opts.title);
  }
  await sheet
    .getByRole("switch", { name: "All-day" })
    .first()
    .waitFor({ state: "visible" });
}

async function injectSignedInUserForQa7(page: Page) {
  await page.evaluate(
    ({ userId }) => {
      localStorage.setItem("itjima.__e2e_user_id__", userId);
    },
    { userId: TEST_USER_ID },
  );
  await page.reload();
  await page.getByRole("link", { name: /^Thoughts/ }).waitFor({ state: "visible" });
}

async function expectToggleStates(
  page: Page,
  startChecked: boolean,
  endChecked: boolean,
) {
  const switches = page.getByRole("dialog").getByRole("switch", { name: "All-day" });
  await expect(switches.nth(0)).toHaveAttribute(
    "aria-checked",
    startChecked ? "true" : "false",
  );
  await expect(switches.nth(1)).toHaveAttribute(
    "aria-checked",
    endChecked ? "true" : "false",
  );
}

async function saveEditSheet(page: Page) {
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Set a reminder" }).click();
  await sheet.getByRole("button", { name: "I'll leave it for then" }).click();
}

test.describe("QA #7 resolveScheduleAllDayFlags (unit)", () => {
  const { y, m, d } = tomorrowParts();
  const base = {
    start_time: isoAt(y, m, d, 0, 0),
    end_time: isoAt(y, m, d, 14, 0),
  };

  test("A start ON / end OFF uses stored flags", () => {
    expect(
      resolveScheduleAllDayFlags({
        ...base,
        all_day: false,
        start_all_day: true,
        end_all_day: false,
      }),
    ).toEqual({ startAllDay: true, endAllDay: false });
  });

  test("B start OFF / end ON uses stored flags", () => {
    expect(
      resolveScheduleAllDayFlags({
        ...base,
        all_day: false,
        start_all_day: false,
        end_all_day: true,
      }),
    ).toEqual({ startAllDay: false, endAllDay: true });
  });

  test("C both ON uses stored flags", () => {
    expect(
      resolveScheduleAllDayFlags({
        ...base,
        all_day: true,
        start_all_day: true,
        end_all_day: true,
      }),
    ).toEqual({ startAllDay: true, endAllDay: true });
  });

  test("D both OFF uses stored flags", () => {
    expect(
      resolveScheduleAllDayFlags({
        ...base,
        all_day: false,
        start_all_day: false,
        end_all_day: false,
      }),
    ).toEqual({ startAllDay: false, endAllDay: false });
  });

  test("E midnight timed schedule with explicit false is not inferred as all-day", () => {
    expect(
      resolveScheduleAllDayFlags({
        start_time: isoAt(y, m, d, 0, 0),
        end_time: isoAt(y, m, d, 0, 0),
        all_day: false,
        start_all_day: false,
        end_all_day: false,
      }),
    ).toEqual({ startAllDay: false, endAllDay: false });
  });

  test("F legacy all_day=true without new fields infers both ON", () => {
    expect(
      resolveScheduleAllDayFlags({
        start_time: isoAt(y, m, d, 0, 0),
        end_time: isoAt(y, m, d, 23, 59),
        all_day: true,
      }),
    ).toEqual({ startAllDay: true, endAllDay: true });
  });

  test("scheduleAllDayFieldsFromConfirm keeps independent flags", () => {
    expect(
      scheduleAllDayFieldsFromConfirm({
        allDay: false,
        startAllDay: true,
        endAllDay: false,
      }),
    ).toEqual({
      all_day: false,
      start_all_day: true,
      end_all_day: false,
    });
  });
});

test.describe("QA #7 schedule all-day E2E", () => {
  test.beforeEach(async ({ page }) => {
    await resetForScheduleAllDay(page);
  });

  test.afterEach(async ({ page }) => {
    const dialog = page.getByRole("dialog");
    if (await dialog.count()) {
      const close = dialog.getByRole("button", { name: "Close" });
      if (await close.count()) await close.first().click();
    }
  });

  test("G guest: scenario A persists after refresh and edit toggles match", async ({
    page,
  }) => {
    const id = `qa7-a-${Date.now()}`;
    const { y, m, d } = tomorrowParts();
    await seedSchedule(page, {
      id,
      text: "Scenario A",
      start_time: isoAt(y, m, d, 0, 0),
      end_time: isoAt(y, m, d, 14, 0),
      alarm: false,
      created_at: new Date().toISOString(),
      all_day: false,
      start_all_day: true,
      end_all_day: false,
      status: "active",
    });

    await page.reload();
    const saved = (await readGuestSchedule(page))[0]!;
    expect(saved.start_all_day).toBe(true);
    expect(saved.end_all_day).toBe(false);

    await openEditTimeStep(page, "Scenario A", { upcoming: true });
    await expectToggleStates(page, true, false);
  });

  test("G guest: scenarios B C D persist after refresh", async ({ page }) => {
    const cases = [
      {
        text: "Scenario B",
        start_all_day: false,
        end_all_day: true,
        all_day: false,
      },
      {
        text: "Scenario C",
        start_all_day: true,
        end_all_day: true,
        all_day: true,
      },
      {
        text: "Scenario D",
        start_all_day: false,
        end_all_day: false,
        all_day: false,
      },
    ] as const;

    for (const c of cases) {
      await resetForScheduleAllDay(page);
      const { y, m, d } = tomorrowParts();
      await seedSchedule(page, {
        id: `qa7-${c.text}-${Date.now()}`,
        text: c.text,
        start_time: isoAt(y, m, d, 9, 0),
        end_time: isoAt(y, m, d, 10, 0),
        alarm: false,
        created_at: new Date().toISOString(),
        all_day: c.all_day,
        start_all_day: c.start_all_day,
        end_all_day: c.end_all_day,
        status: "active",
      });
      await page.reload();
      const saved = (await readGuestSchedule(page))[0]!;
      expect(saved.start_all_day).toBe(c.start_all_day);
      expect(saved.end_all_day).toBe(c.end_all_day);
    }
  });

  test("E guest: 00:00 timed with explicit false keeps edit toggles OFF", async ({
    page,
  }) => {
    const { y, m, d } = tomorrowParts();
    await seedSchedule(page, {
      id: `qa7-e-${Date.now()}`,
      text: "Midnight timed",
      start_time: isoAt(y, m, d, 0, 0),
      end_time: isoAt(y, m, d, 1, 0),
      alarm: false,
      created_at: new Date().toISOString(),
      all_day: false,
      start_all_day: false,
      end_all_day: false,
      status: "active",
    });
    await page.reload();
    await openEditTimeStep(page, "Midnight timed", { upcoming: true });
    await expectToggleStates(page, false, false);
  });

  test("F guest: legacy all_day=true resolves both toggles ON in edit", async ({
    page,
  }) => {
    const { y, m, d } = tomorrowParts();
    await seedSchedule(page, {
      id: `qa7-f-${Date.now()}`,
      text: "Legacy all day",
      start_time: isoAt(y, m, d, 0, 0),
      end_time: isoAt(y, m, d, 23, 59),
      alarm: false,
      created_at: new Date().toISOString(),
      all_day: true,
      status: "active",
    });
    await page.reload();
    await openEditTimeStep(page, "Legacy all day", { upcoming: true });
    await expectToggleStates(page, true, true);
  });

  test("I guest: create then edit preserves updated toggle states on reopen", async ({
    page,
  }) => {
    const title = "Scenario I";
    await openCreateTimeStep(page, { tomorrow: true, title });
    const sheet = page.getByRole("dialog");
    const switches = sheet.getByRole("switch", { name: "All-day" });
    await switches.nth(0).click();
    await saveEditSheet(page);

    await page.reload();
    let saved = (await readGuestSchedule(page))[0]!;
    expect(saved.text).toBe(title);
    expect(saved.start_all_day).toBe(true);
    expect(saved.end_all_day).toBe(false);

    await openEditTimeStep(page, title, { upcoming: true });
    await expectToggleStates(page, true, false);

    await switches.nth(0).click();
    await switches.nth(1).click();
    await saveEditSheet(page);

    await page.reload();
    saved = (await readGuestSchedule(page))[0]!;
    expect(saved.start_all_day).toBe(false);
    expect(saved.end_all_day).toBe(true);

    await openEditTimeStep(page, title, { upcoming: true });
    await expectToggleStates(page, false, true);
  });

  test("H signed-in: cloud payload and reload restore start/end all-day flags", async ({
    page,
  }) => {
    let postedBody: Record<string, unknown> | null = null;

    await page.route("**/rest/v1/inbox**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "content-range": "0--1/0" },
          body: "[]",
        });
        return;
      }
      await route.continue();
    });

    await page.route("**/rest/v1/schedules**", async (route) => {
      const method = route.request().method();
      if (method === "POST") {
        postedBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([postedBody]),
        });
        return;
      }
      if (method === "GET") {
        const row = postedBody
          ? {
              ...postedBody,
              user_id: TEST_USER_ID,
            }
          : [];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "content-range": "0-0/1" },
          body: JSON.stringify(Array.isArray(row) ? row : [row]),
        });
        return;
      }
      if (method === "PATCH" || method === "PUT") {
        postedBody = {
          ...(postedBody ?? {}),
          ...((route.request().postDataJSON() as Record<string, unknown>) ?? {}),
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([postedBody]),
        });
        return;
      }
      await route.continue();
    });

    await page.evaluate(() => {
      localStorage.removeItem("itjima.cloudSchema");
    });
    await injectSignedInUserForQa7(page);

    const cloudTitle = "Cloud scenario B";
    await openCreateTimeStep(page, { tomorrow: true, title: cloudTitle });
    const sheet = page.getByRole("dialog");
    const switches = sheet.getByRole("switch", { name: "All-day" });
    await switches.nth(1).click();
    await saveEditSheet(page);

    await page.waitForFunction(() => {
      const key = `itjima.${"11111111-1111-4111-8111-111111111111"}.schedules`;
      const items = JSON.parse(localStorage.getItem(key) || "[]");
      return items.length > 0;
    });

    expect(postedBody).toBeTruthy();
    expect(postedBody!.start_all_day).toBe(false);
    expect(postedBody!.end_all_day).toBe(true);

    await page.reload();
    await page.waitForFunction(({ userId }) => {
      const key = `itjima.${userId}.schedules`;
      const items = JSON.parse(localStorage.getItem(key) || "[]") as {
        start_all_day?: boolean;
        end_all_day?: boolean;
      }[];
      return (
        items.length === 1 &&
        items[0]?.start_all_day === false &&
        items[0]?.end_all_day === true
      );
    }, { userId: TEST_USER_ID });

    const userKey = `itjima.${TEST_USER_ID}.schedules`;
    const stored = JSON.parse(
      await page.evaluate((k) => localStorage.getItem(k) || "[]", userKey),
    ) as SeedSchedule[];
    expect(stored[0]!.start_all_day).toBe(false);
    expect(stored[0]!.end_all_day).toBe(true);

    await openEditTimeStep(page, cloudTitle, { upcoming: true });
    await expectToggleStates(page, false, true);
  });
});
