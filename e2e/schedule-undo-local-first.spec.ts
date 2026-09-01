import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  addThought,
  injectSignedInUser,
  phone,
  TEST_USER_ID,
} from "./helpers";

type InboxRow = {
  id: string;
  text: string;
  temporal_state?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

type ScheduleRow = {
  id: string;
  source_id?: string | null;
  text: string;
};

type Tombstone = {
  id: string;
  table: string;
};

const inboxKey = `itjima.${TEST_USER_ID}.inbox`;
const scheduleKey = `itjima.${TEST_USER_ID}.schedules`;
const tombstonesKey = `itjima.${TEST_USER_ID}.tombstones`;

async function rows<T>(page: Page, key: string): Promise<T[]> {
  return page.evaluate((storageKey) => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]") as T[];
    } catch {
      return [];
    }
  }, key);
}

async function installUndoDeleteFailure(page: Page) {
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
        body: JSON.stringify({ message: "schedule delete temporarily failed" }),
      });
      return;
    }

    if (method === "POST" || method === "PATCH") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: "[]",
      });
      return;
    }

    if (method === "DELETE") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.continue();
  });
}

test.describe("saved schedule Undo stays locally coherent while cloud delete retries", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Schedule DELETE 500 still completes local Undo and preserves its tombstone", async ({
    page,
  }) => {
    await resetAppState(page);
    await installUndoDeleteFailure(page);
    await injectSignedInUser(page);

    const text = "Dentist tomorrow at 3pm";
    await addThought(page, text);

    await expect(phone(page).getByTestId("saved-schedule-feedback")).toBeVisible();
    await expect.poll(async () => (await rows<ScheduleRow>(page, scheduleKey)).length).toBe(1);

    const beforeInbox = (await rows<InboxRow>(page, inboxKey)).find(
      (row) => row.text === text,
    );
    expect(beforeInbox?.temporal_state).toBe("exact_datetime");
    const scheduleId = (await rows<ScheduleRow>(page, scheduleKey))[0]!.id;

    const undo = page.getByRole("button", { name: "Undo", exact: true }).last();
    await expect(undo).toBeVisible();
    await undo.click();

    await expect(page.getByText("Restored as left here", { exact: true })).toBeVisible();
    await expect(phone(page).getByTestId("saved-schedule-feedback")).toHaveCount(0);
    await expect.poll(async () => (await rows<ScheduleRow>(page, scheduleKey)).length).toBe(0);

    const afterInbox = (await rows<InboxRow>(page, inboxKey)).find(
      (row) => row.text === text,
    );
    expect(afterInbox?.temporal_state).toBe("no_time");
    expect(afterInbox?.start_time ?? null).toBeNull();
    expect(afterInbox?.end_time ?? null).toBeNull();

    const pendingDeletes = await rows<Tombstone>(page, tombstonesKey);
    expect(
      pendingDeletes.some(
        (row) => row.id === scheduleId && row.table === "schedules",
      ),
    ).toBe(true);

    // Reload while the remote delete is still failing. Local product truth must
    // stay coherent: one canonical note with no temporal projection.
    await page.reload();
    await phone(page).getByRole("link", { name: /^Capture$/ }).waitFor();

    expect(await rows<ScheduleRow>(page, scheduleKey)).toHaveLength(0);
    const reloadedInbox = (await rows<InboxRow>(page, inboxKey)).find(
      (row) => row.text === text,
    );
    expect(reloadedInbox?.temporal_state).toBe("no_time");
    expect(reloadedInbox?.start_time ?? null).toBeNull();
  });
});
