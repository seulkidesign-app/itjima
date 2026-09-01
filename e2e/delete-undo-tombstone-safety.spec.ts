import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  injectSignedInUser,
  TEST_USER_ID,
  openContextMenu,
  clickContextMenuItem,
} from "./helpers";

type InboxRow = {
  id: string;
  text: string;
  images: string[];
  created_at: string;
  status?: string;
  raw_text?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean | null;
  temporal_state?: string | null;
  structured_at?: string | null;
  content_revision?: number;
  capture_state?: string;
};

type ScheduleRow = {
  id: string;
  text: string;
  start_time: string;
  end_time: string;
  created_at: string;
  source_id?: string | null;
  raw_text?: string | null;
  status?: string;
  alarm?: boolean;
};

type Tombstone = { id: string; table: string };

const inboxKey = `itjima.${TEST_USER_ID}.inbox`;
const scheduleKey = `itjima.${TEST_USER_ID}.schedules`;
const tombstonesKey = `itjima.${TEST_USER_ID}.tombstones`;

async function readRows<T>(page: Page, key: string): Promise<T[]> {
  return page.evaluate((storageKey) => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]") as T[];
    } catch {
      return [];
    }
  }, key);
}

async function seedTimedRecord(page: Page, text: string) {
  await resetAppState(page);
  const id = crypto.randomUUID();
  const start = new Date();
  start.setDate(start.getDate() + 2);
  start.setHours(15, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const createdAt = new Date().toISOString();

  const inbox: InboxRow = {
    id,
    text,
    images: [],
    created_at: createdAt,
    status: "active",
    raw_text: text,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    all_day: false,
    temporal_state: "exact_datetime",
    structured_at: createdAt,
    content_revision: 0,
    capture_state: "saved",
  };
  const schedule: ScheduleRow = {
    id,
    text,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    created_at: createdAt,
    source_id: id,
    raw_text: text,
    status: "active",
    alarm: false,
  };

  await page.evaluate(
    ({ inboxKey, scheduleKey, inbox, schedule }) => {
      localStorage.setItem(inboxKey, JSON.stringify([inbox]));
      localStorage.setItem(scheduleKey, JSON.stringify([schedule]));
    },
    { inboxKey, scheduleKey, inbox, schedule },
  );
  return { inbox, schedule };
}

async function installScheduleDeleteFailure(page: Page) {
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0--1/0" },
        body: "[]",
      });
      return;
    }

    if (method === "DELETE" && table === "schedules") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "schedule delete failed" }),
      });
      return;
    }

    if (method === "POST" || method === "PATCH") {
      await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      return;
    }

    if (method === "DELETE") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.continue();
  });
}

test.describe("delete undo — schedule tombstone safety", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("failed schedule cloud delete cannot erase a projection restored by Undo", async ({
    page,
  }) => {
    const text = `Undo tombstone ${Date.now()}`;
    const original = await seedTimedRecord(page, text);
    await installScheduleDeleteFailure(page);
    await injectSignedInUser(page);
    await phone(page).getByRole("link", { name: /^Capture$/ }).waitFor();
    await expect(phone(page).getByText(text, { exact: true })).toBeVisible();

    await openContextMenu(page, text);
    await clickContextMenuItem(page, "Delete");

    await expect.poll(async () => (await readRows<ScheduleRow>(page, scheduleKey)).length).toBe(0);
    let tombstones = await readRows<Tombstone>(page, tombstonesKey);
    expect(
      tombstones.some(
        (row) => row.id === original.schedule.id && row.table === "schedules",
      ),
    ).toBe(true);

    const undo = page.getByRole("button", { name: "Undo", exact: true }).last();
    await expect(undo).toBeVisible();
    await undo.click();

    await expect.poll(async () => (await readRows<ScheduleRow>(page, scheduleKey)).length).toBe(1);
    tombstones = await readRows<Tombstone>(page, tombstonesKey);
    expect(
      tombstones.some(
        (row) => row.id === original.schedule.id && row.table === "schedules",
      ),
    ).toBe(false);

    const restoredBeforeReload = await readRows<ScheduleRow>(page, scheduleKey);
    expect(restoredBeforeReload[0]?.id).toBe(original.schedule.id);
    expect(restoredBeforeReload[0]?.source_id).toBe(original.inbox.id);

    await page.reload();
    await phone(page).getByRole("link", { name: /^Capture$/ }).waitFor();

    const restoredAfterReload = await readRows<ScheduleRow>(page, scheduleKey);
    expect(restoredAfterReload).toHaveLength(1);
    expect(restoredAfterReload[0]?.id).toBe(original.schedule.id);
    expect(restoredAfterReload[0]?.source_id).toBe(original.inbox.id);

    const inboxAfterReload = await readRows<InboxRow>(page, inboxKey);
    const canonical = inboxAfterReload.find((row) => row.id === original.inbox.id);
    expect(canonical?.status).toBe("active");
    expect(canonical?.text).toBe(text);
  });
});
