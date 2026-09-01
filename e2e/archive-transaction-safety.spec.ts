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
  created_at: string;
  status?: string;
  raw_text?: string | null;
  temporal_state?: string | null;
  content_revision?: number;
  capture_state?: string;
};

type ArchiveRow = {
  id: string;
  text: string;
  source_id?: string | null;
};

const inboxKey = `itjima.${TEST_USER_ID}.inbox`;
const archiveKey = `itjima.${TEST_USER_ID}.archive`;
const tombstonesKey = `itjima.${TEST_USER_ID}.tombstones`;

async function seedSignedInNote(page: Page, text: string) {
  await resetAppState(page);
  const row: InboxRow = {
    id: crypto.randomUUID(),
    text,
    raw_text: text,
    created_at: new Date().toISOString(),
    status: "active",
    temporal_state: "no_time",
    content_revision: 0,
    capture_state: "saved",
  };

  await page.evaluate(
    ({ key, row }) => localStorage.setItem(key, JSON.stringify([row])),
    { key: inboxKey, row },
  );
  return row;
}

async function readRows<T>(page: Page, key: string): Promise<T[]> {
  return page.evaluate((storageKey) => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]") as T[];
    } catch {
      return [];
    }
  }, key);
}

async function installCloudRoutes(
  page: Page,
  mode: "archive_insert_fails" | "inbox_delete_fails",
) {
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

    if (method === "POST" && table === "archive") {
      if (mode === "archive_insert_fails") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "archive insert failed" }),
        });
        return;
      }
      await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      return;
    }

    if (method === "DELETE" && table === "inbox") {
      if (mode === "inbox_delete_fails") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "inbox delete failed" }),
        });
        return;
      }
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (method === "DELETE" && table === "archive") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (method === "POST" || method === "PATCH") {
      await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      return;
    }

    await route.continue();
  });
}

async function bootSignedIn(page: Page) {
  await injectSignedInUser(page);
  await phone(page).getByRole("link", { name: /^Capture$/ }).waitFor();
}

test.describe("archive transaction safety — signed in", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("archive cloud insert failure leaves the canonical inbox record untouched", async ({
    page,
  }) => {
    const text = `Archive insert fail ${Date.now()}`;
    const original = await seedSignedInNote(page, text);
    await installCloudRoutes(page, "archive_insert_fails");
    await bootSignedIn(page);

    await expect(phone(page).getByText(text, { exact: true })).toBeVisible();
    await openContextMenu(page, text);
    await clickContextMenuItem(page, "Save to vault");

    await expect(page.getByText(/Didn't move.*still here/i)).toBeVisible();
    await expect(phone(page).getByText(text, { exact: true })).toBeVisible();

    const inbox = await readRows<InboxRow>(page, inboxKey);
    expect(inbox.filter((row) => row.id === original.id)).toHaveLength(1);
    expect(await readRows<ArchiveRow>(page, archiveKey)).toHaveLength(0);
  });

  test("inbox cloud delete failure compensates the archive and restores the same canonical id", async ({
    page,
  }) => {
    const text = `Inbox delete fail ${Date.now()}`;
    const original = await seedSignedInNote(page, text);
    await installCloudRoutes(page, "inbox_delete_fails");
    await bootSignedIn(page);

    await openContextMenu(page, text);
    await clickContextMenuItem(page, "Save to vault");

    await expect(page.getByText(/Didn't move.*still here/i)).toBeVisible();
    await expect(phone(page).getByText(text, { exact: true })).toBeVisible();

    const inbox = await readRows<InboxRow>(page, inboxKey);
    const restored = inbox.filter((row) => row.id === original.id);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.created_at).toBe(original.created_at);
    expect(restored[0]?.raw_text).toBe(text);
    expect(await readRows<ArchiveRow>(page, archiveKey)).toHaveLength(0);

    const tombstones = await readRows<Array<{ id: string; table: string }>[number]>(
      page,
      tombstonesKey,
    );
    expect(tombstones.some((row) => row.id === original.id && row.table === "inbox")).toBe(false);
  });
});
