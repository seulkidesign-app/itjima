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
  await phone(page).getByRole("link", { name: /^Inbox/ }).waitFor({
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
  await phone(page).getByRole("link", { name: /^Inbox/ }).waitFor({
    state: "visible",
  });
}

export async function gotoInbox(page: Page) {
  if (!page.url().includes("127.0.0.1")) {
    await page.goto("/");
  }
  await phone(page).getByRole("link", { name: /^Inbox/ }).waitFor({
    state: "visible",
  });
}

export async function addThought(page: Page, text: string) {
  const frame = phone(page);
  const input = frame.locator("textarea").first();
  await input.fill(text);
  await frame.getByRole("button", { name: "Leave it", exact: true }).click();
  await frame.getByText(text, { exact: true }).waitFor({ state: "visible" });
}

export async function openContextMenu(page: Page, thoughtText: string) {
  const frame = phone(page);
  const bubble = frame.getByText(thoughtText, { exact: true }).first();
  await bubble.dispatchEvent("pointerdown", { button: 0, pointerId: 1 });
  await page.waitForTimeout(520);
  await bubble.dispatchEvent("pointerup", { button: 0, pointerId: 1 });
  await frame.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).waitFor({
    state: "visible",
  });
}

export async function getTabCount(page: Page, tab: "Inbox" | "When" | "Saved") {
  const link = phone(page).getByRole("link", { name: new RegExp(`^${tab}`) });
  const text = (await link.first().textContent()) ?? "";
  const m = text.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
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

/** About / Feedback on desktop live in SideNav; on mobile in TopNav. */
export async function openAbout(page: Page) {
  const about = page.getByRole("button", { name: "About", exact: true });
  if (await about.count()) {
    await about.first().click();
    return;
  }
  await phone(page).getByRole("button", { name: "About", exact: true }).click();
}

export async function openFeedback(page: Page) {
  const fb = page.getByRole("button", { name: "Contact · Feedback", exact: true });
  if (await fb.count()) {
    await fb.first().click();
    return;
  }
  await phone(page).getByRole("button", { name: "Contact · Feedback", exact: true }).click();
}
