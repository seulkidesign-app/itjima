import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  injectSignedInUser,
  gotoArchiveListView,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  TEST_USER_ID,
} from "./helpers";

const USER_INBOX_KEY = `itjima.${TEST_USER_ID}.inbox`;
const USER_ARCHIVE_KEY = `itjima.${TEST_USER_ID}.archive`;
const TOMBSTONES_KEY = `itjima.${TEST_USER_ID}.tombstones`;

type InboxSeed = {
  id: string;
  text: string;
  images: string[];
  created_at: string;
  status: "active";
};

async function readUserList(page: Page, key: string): Promise<unknown[]> {
  return page.evaluate((k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || "[]") as unknown[];
    } catch {
      return [];
    }
  }, key);
}

async function seedGuestInbox(page: Page, items: InboxSeed[]) {
  await page.evaluate(
    ({ key, rows }) => {
      localStorage.setItem(key, JSON.stringify(rows));
    },
    { key: GUEST_INBOX_KEY, rows: items },
  );
}

function makeInboxSeed(text: string, id: string): InboxSeed {
  return {
    id,
    text,
    images: [],
    created_at: new Date().toISOString(),
    status: "active",
  };
}

async function mockEmptyCloudTables(page: Page) {
  for (const table of ["inbox", "schedules", "archive"] as const) {
    await page.route(`**/rest/v1/${table}**`, async (route) => {
      const method = route.request().method();
      if (method === "GET") {
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
  }
}

test.describe("data integrity (guest upload + tombstones)", () => {
  test("partial guest upload failure keeps guest rows and surfaces sync error", async ({
    page,
  }) => {
    await resetAppState(page);
    await mockEmptyCloudTables(page);

    const itemA = makeInboxSeed(
      "Guest alpha",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    const itemB = makeInboxSeed(
      "Guest beta",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    await seedGuestInbox(page, [itemA, itemB]);

    let upsertCount = 0;
    await page.route("**/rest/v1/inbox**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "content-range": "0--1/0" },
          body: "[]",
        });
        return;
      }
      if (method === "POST") {
        upsertCount += 1;
        if (upsertCount === 1) {
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: "[]",
          });
          return;
        }
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "e2e simulated upsert failure" }),
        });
        return;
      }
      await route.continue();
    });

    await injectSignedInUser(page);

    await expect
      .poll(async () => (await readGuestList(page, GUEST_INBOX_KEY)).length)
      .toBe(2);
    const guest = await readGuestList(page, GUEST_INBOX_KEY);
    expect(guest.map((row) => (row as InboxSeed).text).sort()).toEqual([
      "Guest alpha",
      "Guest beta",
    ]);
    await page
      .getByText("Keeping safe paused for a moment")
      .waitFor({ state: "visible", timeout: 15_000 });
  });

  test("retry after partial failure clears guest only when all rows are confirmed", async ({
    page,
  }) => {
    await resetAppState(page);
    await mockEmptyCloudTables(page);

    const itemA = makeInboxSeed(
      "Retry alpha",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    );
    const itemB = makeInboxSeed(
      "Retry beta",
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    );
    await seedGuestInbox(page, [itemA, itemB]);

    let failUpserts = true;
    let upsertCount = 0;
    await page.route("**/rest/v1/inbox**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        const uploaded = upsertCount >= 1 ? [itemA] : [];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "content-range": `0-${Math.max(uploaded.length - 1, -1)}/${uploaded.length}`,
          },
          body: JSON.stringify(
            uploaded.map((row) => ({
              ...row,
              user_id: TEST_USER_ID,
            })),
          ),
        });
        return;
      }
      if (method === "POST") {
        upsertCount += 1;
        if (failUpserts && upsertCount === 2) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "e2e simulated upsert failure" }),
          });
          return;
        }
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: "[]",
        });
        return;
      }
      await route.continue();
    });

    await injectSignedInUser(page);
    await page
      .getByText("Keeping safe paused for a moment")
      .waitFor({ state: "visible", timeout: 15_000 });
    expect((await readGuestList(page, GUEST_INBOX_KEY)).length).toBe(2);

    failUpserts = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();

    await expect
      .poll(async () => (await readGuestList(page, GUEST_INBOX_KEY)).length)
      .toBe(0);
    await expect
      .poll(async () => (await readUserList(page, USER_INBOX_KEY)).length)
      .toBe(2);
  });

  test("offline delete does not resurrect after cloud fetch when tombstone is queued", async ({
    page,
  }) => {
    const archiveId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const archiveText = `Tombstone target ${Date.now()}`;
    const archiveItem = {
      id: archiveId,
      text: archiveText,
      images: [] as string[],
      created_at: new Date().toISOString(),
    };

    await resetAppState(page);

    let deleteShouldFail = true;
    await page.route("**/rest/v1/archive**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "content-range": "0-0/1" },
          body: JSON.stringify([{ ...archiveItem, user_id: TEST_USER_ID }]),
        });
        return;
      }
      if (method === "DELETE") {
        if (deleteShouldFail) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "e2e simulated delete failure" }),
          });
          return;
        }
        await route.fulfill({
          status: 204,
          contentType: "application/json",
          body: "",
        });
        return;
      }
      if (method === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: "[]",
        });
        return;
      }
      await route.continue();
    });

    for (const table of ["inbox", "schedules"] as const) {
      await page.route(`**/rest/v1/${table}**`, async (route) => {
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
    }

    await page.evaluate(
      ({ userId, item }) => {
        localStorage.setItem(
          `itjima.${userId}.archive`,
          JSON.stringify([item]),
        );
      },
      { userId: TEST_USER_ID, item: archiveItem },
    );
    await injectSignedInUser(page);
    await gotoArchiveListView(page);
    await phone(page)
      .getByRole("button")
      .filter({ hasText: archiveText })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
    await phone(page)
      .getByRole("button")
      .filter({ hasText: archiveText })
      .first()
      .click();
    await phone(page)
      .getByRole("button", { name: "Remove", exact: true })
      .click();

    await expect
      .poll(async () => (await readUserList(page, TOMBSTONES_KEY)).length)
      .toBeGreaterThan(0);
    const tombstones = await readUserList(page, TOMBSTONES_KEY);
    expect((tombstones[0] as { id: string; table: string }).id).toBe(archiveId);

    await page.reload();
    await phone(page)
      .getByRole("link", { name: /^Archive/ })
      .click();
    await expect(
      phone(page).getByText(archiveText, { exact: true }),
    ).toHaveCount(0);

    deleteShouldFail = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect
      .poll(async () => (await readUserList(page, TOMBSTONES_KEY)).length)
      .toBe(0);
  });

  test("tombstone delete retry does not resurrect stale cloud row in same sync", async ({
    page,
  }) => {
    const archiveId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const archiveText = `Stale resurrection ${Date.now()}`;
    const archiveItem = {
      id: archiveId,
      text: archiveText,
      images: [] as string[],
      created_at: new Date().toISOString(),
    };

    await resetAppState(page);

    let deleteShouldFail = true;
    await page.route("**/rest/v1/archive**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "content-range": "0-0/1" },
          body: JSON.stringify([{ ...archiveItem, user_id: TEST_USER_ID }]),
        });
        return;
      }
      if (method === "DELETE") {
        if (deleteShouldFail) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "e2e simulated delete failure" }),
          });
          return;
        }
        await route.fulfill({
          status: 204,
          contentType: "application/json",
          body: "",
        });
        return;
      }
      if (method === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: "[]",
        });
        return;
      }
      await route.continue();
    });

    for (const table of ["inbox", "schedules"] as const) {
      await page.route(`**/rest/v1/${table}**`, async (route) => {
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
    }

    await page.evaluate(
      ({ userId, item }) => {
        localStorage.setItem(
          `itjima.${userId}.archive`,
          JSON.stringify([item]),
        );
      },
      { userId: TEST_USER_ID, item: archiveItem },
    );
    await injectSignedInUser(page);
    await gotoArchiveListView(page);
    await phone(page)
      .getByRole("button")
      .filter({ hasText: archiveText })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
    await phone(page)
      .getByRole("button")
      .filter({ hasText: archiveText })
      .first()
      .click();
    await phone(page)
      .getByRole("button", { name: "Remove", exact: true })
      .click();

    await expect
      .poll(async () => (await readUserList(page, TOMBSTONES_KEY)).length)
      .toBeGreaterThan(0);
    await expect(
      phone(page).getByText(archiveText, { exact: true }),
    ).toHaveCount(0);
    const localAfterDelete = await readUserList(page, USER_ARCHIVE_KEY);
    expect(localAfterDelete).toHaveLength(0);

    deleteShouldFail = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();

    await expect
      .poll(async () => (await readUserList(page, TOMBSTONES_KEY)).length)
      .toBe(0);
    const localAfterRetry = await readUserList(page, USER_ARCHIVE_KEY);
    expect(localAfterRetry).toHaveLength(0);
    expect(
      localAfterRetry.some((row) => (row as { id: string }).id === archiveId),
    ).toBe(false);
    await expect(
      phone(page).getByText(archiveText, { exact: true }),
    ).toHaveCount(0);
  });
});
