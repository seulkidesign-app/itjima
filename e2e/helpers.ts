import { expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

export const GUEST_INBOX_KEY = "itjima.guest.inbox";
export const GUEST_ARCHIVE_KEY = "itjima.guest.archive";
export const GUEST_SCHEDULE_KEY = "itjima.guest.schedules";
export const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";

export function getSupabaseProjectId(): string | null {
  try {
    const env = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    const m = env.match(/^VITE_SUPABASE_PROJECT_ID=(.+)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
  } catch {
    return null;
  }
}

export async function waitForE2eSignedIn(page: Page) {
  await page.waitForFunction(
    ({ userId }) => localStorage.getItem("itjima.__e2e_user_id__") === userId,
    { userId: TEST_USER_ID },
  );
}

/** Wait until mocked admin role checks finish (must start before page reload). */
export function waitForAdminRole(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/rest/v1/user_roles") &&
      response.request().method() === "GET" &&
      response.ok(),
  );
}

export async function injectSignedInUser(
  page: Page,
  options?: { awaitAdminRole?: boolean },
) {
  const adminRoleResponse = options?.awaitAdminRole
    ? waitForAdminRole(page)
    : null;
  await page.evaluate(
    ({ userId }) => {
      localStorage.setItem("itjima.__e2e_user_id__", userId);
    },
    { userId: TEST_USER_ID },
  );
  await page.reload();
  await phone(page).getByRole("link", { name: /^Throw/ }).waitFor({
    state: "visible",
  });
  await waitForE2eSignedIn(page);
  if (adminRoleResponse) await adminRoleResponse;
}

export async function blockCloudMutations(page: Page) {
  await page.route("**/rest/v1/**", async (route) => {
    const method = route.request().method();
    if (method === "DELETE" || method === "PATCH" || method === "POST") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "e2e simulated cloud failure", code: "500" }),
      });
      return;
    }
    await route.continue();
  });
}

export function phone(page: Page): Locator {
  return page.locator(".phone-frame");
}

export async function installAnalyticsSpy(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents = [];
    window.gtag = (...args: unknown[]) => {
      (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents.push(args);
    };
  });
}

export async function readAnalytics(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __e2eEvents: unknown[] }).__e2eEvents ?? [],
  );
}

export async function resetAppState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("itjima.")) localStorage.removeItem(k);
    }
    localStorage.setItem("itjima_lang", "en");
    sessionStorage.clear();
  });
  await page.reload();
  await phone(page).getByRole("link", { name: /^Throw/ }).waitFor({
    state: "visible",
  });
}

export async function gotoInbox(page: Page) {
  if (!page.url().includes("127.0.0.1")) {
    await page.goto("/");
  }
  await phone(page).getByRole("link", { name: /^Throw/ }).waitFor({
    state: "visible",
  });
}

export async function gotoArchiveListView(page: Page) {
  await phone(page).getByRole("link", { name: /^Archive/ }).click();
  await phone(page)
    .getByRole("heading", { name: "Archive", exact: true })
    .waitFor({ state: "visible" });
}

export async function gotoScheduleUpcoming(page: Page) {
  await phone(page).getByRole("link", { name: /^Schedule/ }).click();
  await phone(page).getByRole("tab", { name: "Upcoming" }).click();
}

export async function openArchiveEditDialog(page: Page, thoughtText: string) {
  await gotoArchiveListView(page);
  const row = phone(page)
    .getByRole("button")
    .filter({ hasText: thoughtText })
    .first();
  await row.dispatchEvent("pointerdown");
  await page.waitForTimeout(550);
  await row.dispatchEvent("pointerup");
  await phone(page)
    .getByRole("dialog", { name: /Refine name/i })
    .waitFor({ state: "visible" });
}

export async function dismissArchiveEditDialog(page: Page) {
  await phone(page).getByTestId("archive-edit-dialog").click({
    position: { x: 8, y: 8 },
    force: true,
  });
  await expect(phone(page).getByTestId("archive-edit-dialog")).toHaveCount(0);
}

export async function completeScheduleDialog(page: Page) {
  const sheet = page.getByRole("dialog").last();
  await sheet.waitFor({ state: "visible" });

  const nlPrimary = sheet.getByTestId("promise-primary");
  if (await nlPrimary.isVisible().catch(() => false)) {
    await nlPrimary.click();
    return;
  }

  const pickTime = sheet.getByRole("button", { name: "Pick a time" });
  if (await pickTime.isVisible()) {
    await pickTime.click();
  }
  await sheet.getByRole("button", { name: "Set a reminder" }).click();
  await sheet.getByRole("button", { name: "I'll leave it for then" }).click();
}

export async function dismissInlinePromise(page: Page) {
  const frame = phone(page);
  const promise = frame.getByTestId("inline-promise").last();
  if (!(await promise.isVisible().catch(() => false))) return;

  await promise.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  const keepClarify = promise.getByTestId("promise-keep");
  if (await keepClarify.isVisible().catch(() => false)) {
    await keepClarify.click({ force: true });
    return;
  }

  const primary = promise.getByTestId("promise-primary");
  if (await primary.isVisible().catch(() => false)) {
    const label = ((await primary.textContent()) ?? "").trim();
    if (/Keep here|그대로 두기/i.test(label)) {
      await primary.click({ force: true });
      return;
    }
  }

  const correct = promise.getByTestId("promise-correct");
  if (await correct.isVisible().catch(() => false)) {
    await correct.click({ force: true });
    await promise
      .getByTestId("promise-correct-menu")
      .getByRole("button", { name: /Keep here|그대로 두기/ })
      .click({ force: true });
    return;
  }

  const manual = promise.getByTestId("promise-manual");
  if (await manual.isVisible().catch(() => false)) {
    await manual.click({ force: true });
    await frame
      .getByTestId("promise-edit-menu")
      .getByRole("button", { name: /Keep here|그대로 두기/ })
      .click({ force: true });
  }
}

/** @deprecated use dismissInlinePromise */
export async function dismissReleaseOverlay(page: Page) {
  await dismissInlinePromise(page);
}

export async function addThought(page: Page, text: string) {
  const frame = phone(page);
  const input = frame.locator("textarea").first();
  await input.fill(text);
  await input.focus();
  await input.press("Control+Enter");
  await frame
    .getByRole("paragraph")
    .filter({ hasText: text })
    .first()
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    ({ thoughtText }) => {
      for (const key of Object.keys(localStorage)) {
        if (!key.endsWith(".inbox")) continue;
        const items = JSON.parse(localStorage.getItem(key) || "[]") as {
          text: string;
        }[];
        if (items.some((item) => item.text === thoughtText)) return true;
      }
      return false;
    },
    { thoughtText: text },
  );
  await dismissInlinePromise(page);
}

export async function openContextMenu(page: Page, thoughtText: string) {
  const frame = phone(page);
  await dismissInlinePromise(page);
  await openContextMenuRaw(page, thoughtText);
}

export async function openContextMenuRaw(page: Page, thoughtText: string) {
  const frame = phone(page);
  const bubble = frame
    .getByRole("paragraph")
    .filter({ hasText: thoughtText })
    .first();
  await bubble.dispatchEvent("pointerdown", { button: 0, pointerId: 1 });
  await page.waitForTimeout(700);
  await bubble.dispatchEvent("pointerup", { button: 0, pointerId: 1 });
  await frame
    .getByRole("dialog")
    .getByRole("button", { name: "Save to vault", exact: true })
    .waitFor({
      state: "visible",
      timeout: 10_000,
    });
}

export async function getTabCount(
  page: Page,
  tab: "Throw" | "Schedule" | "Archive",
) {
  const key =
    tab === "Throw"
      ? GUEST_INBOX_KEY
      : tab === "Schedule"
        ? GUEST_SCHEDULE_KEY
        : GUEST_ARCHIVE_KEY;
  const list = await readGuestList(page, key);
  return list.length;
}

export async function readGuestList(page: Page, key: string): Promise<unknown[]> {
  return page.evaluate((k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || "[]") as unknown[];
    } catch {
      return [];
    }
  }, key);
}

export async function openSettings(page: Page) {
  await phone(page).getByRole("button", { name: "Settings", exact: true }).click();
}

export async function openBrandHub(page: Page) {
  await gotoInbox(page);
  await phone(page)
    .getByRole("button", { name: "Itjima (잊지마)", exact: true })
    .click();
}

/** Brand hub on Home replaces the old about sheet. */
export async function openAbout(page: Page) {
  await openBrandHub(page);
}

export async function openFeedback(page: Page) {
  await openBrandHub(page);
  await phone(page).getByRole("button", { name: "Send feedback" }).click();
}

/** Stub Supabase admin role checks for signed-in E2E. */
export async function mockAdminRole(page: Page) {
  await page.route("**/rest/v1/user_roles**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "0-0/1" },
      body: JSON.stringify([{ role: "admin", user_id: TEST_USER_ID }]),
    });
  });
  await page.route("**/rest/v1/rpc/has_role**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "true",
    });
  });
}
