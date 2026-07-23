import type { Page, Locator } from "@playwright/test";
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

export async function injectSignedInUser(page: Page) {
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
  await phone(page).getByRole("link", { name: /^Vault/ }).click();
  await phone(page)
    .getByRole("heading", { name: "Vault", exact: true })
    .waitFor({ state: "visible" });
}

export async function completeScheduleDialog(page: Page) {
  const sheet = page.getByRole("dialog");
  await sheet.waitFor({ state: "visible" });
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

  const actions = promise.getByTestId("promise-actions");
  if (!(await actions.isVisible().catch(() => false))) return;

  await promise.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);

  const latest = frame.getByTestId("inline-promise").last();
  const latestActions = latest.getByTestId("promise-actions");
  if (!(await latestActions.isVisible().catch(() => false))) return;

  const primary = latest.getByTestId("promise-primary");
  const label = ((await primary.textContent()) ?? "").trim();
  if (/Keep here|그대로 두기/i.test(label)) {
    await primary.click({ force: true });
  } else {
    await latest.getByTestId("promise-edit").click({ force: true });
    const keep = frame
      .getByTestId("promise-edit-menu")
      .getByRole("button", { name: "Keep here", exact: true });
    await keep.click({ force: true });
  }
  await latestActions.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
}

/** @deprecated use dismissInlinePromise */
export async function dismissReleaseOverlay(page: Page) {
  await dismissInlinePromise(page);
}

export async function addThought(page: Page, text: string) {
  const frame = phone(page);
  const input = frame.locator("textarea").first();
  await input.fill(text);
  await frame.getByRole("button", { name: "Leave it", exact: true }).click();
  await frame.getByTestId("inline-promise").last().waitFor({ state: "visible" });
  await frame.getByText(text, { exact: true }).first().waitFor({ state: "visible" });
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
  tab: "Throw" | "Today" | "Vault",
) {
  const key =
    tab === "Throw"
      ? GUEST_INBOX_KEY
      : tab === "Today"
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

/** About / Feedback live in the settings sheet on mobile. */
export async function openAbout(page: Page) {
  await openSettings(page);
  await phone(page).getByRole("button", { name: "About Itjima", exact: true }).click();
}

export async function openFeedback(page: Page) {
  await openSettings(page);
  await phone(page)
    .getByRole("button", { name: "Contact · Feedback", exact: true })
    .click();
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
