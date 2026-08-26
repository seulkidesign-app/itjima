import { expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

export const GUEST_INBOX_KEY = "itjima.guest.inbox";
export const GUEST_ARCHIVE_KEY = "itjima.guest.archive";
export const GUEST_SCHEDULE_KEY = "itjima.guest.schedules";
export const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
export const CAPTURE_LINK_NAME = /^Capture$/;
export const CAPTURE_LINK_NAME_KO = /^남기기$/;

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
  await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor({
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
  await page.goto("/app");
  await page.evaluate(async () => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("itjima.")) localStorage.removeItem(k);
    }
    localStorage.setItem("itjima_lang", "en");
    localStorage.setItem("itjima.swipe.tutorial.done", "1");
    sessionStorage.clear();
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  });
  await page.reload();
  await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor({
    state: "visible",
  });
}

export async function gotoInbox(page: Page) {
  if (!page.url().includes("/app")) {
    await page.goto("/app");
  }
  await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor({
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
  const search = phone(page).getByPlaceholder("Find a thought you kept");
  await search.fill(thoughtText);
  const row = phone(page).getByTestId("archive-list-row").first();
  await row.waitFor({ state: "visible" });
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

  const pickTime = sheet.getByRole("button", { name: /Pick a time|Add time/i });
  if (await pickTime.isVisible()) {
    await pickTime.click();
  }
  await sheet.getByRole("button", { name: "Set a reminder" }).click();
  await sheet.getByRole("button", { name: "Add to schedule" }).click();
}

async function forceAcknowledgeInlinePromises(page: Page) {
  await page.evaluate(() => {
    const inboxKey = Object.keys(localStorage).find((k) => k.endsWith(".inbox"));
    if (!inboxKey) return;
    const items = JSON.parse(localStorage.getItem(inboxKey) || "[]") as {
      id: string;
    }[];
    localStorage.setItem(
      "itjima.nl.acknowledged.guest",
      JSON.stringify(items.map((i) => i.id)),
    );
  });
  await page.reload();
  await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor({
    state: "visible",
  });
}

export async function dismissInlinePromise(page: Page) {
  const frame = phone(page);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const promise = frame.getByTestId("inline-promise").first();
    if (!(await promise.isVisible().catch(() => false))) return;

    await promise.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);

    const keepClarify = promise.getByTestId("promise-keep");
    if (await keepClarify.isVisible().catch(() => false)) {
      await keepClarify.click({ force: true });
      await page.waitForTimeout(200);
      continue;
    }

    const primary = promise.getByTestId("promise-primary");
    if (await primary.isVisible().catch(() => false)) {
      const label = ((await primary.textContent()) ?? "").trim();
      if (/Keep here|그대로 두기/i.test(label)) {
        await primary.click({ force: true });
        await page.waitForTimeout(200);
        continue;
      }
    }

    const manual = promise.getByTestId("promise-manual");
    if (await manual.isVisible().catch(() => false)) {
      await manual.click({ force: true });
      await page.waitForTimeout(100);
      const editMenu = promise.getByTestId("promise-edit-menu");
      if (await editMenu.isVisible().catch(() => false)) {
        await editMenu
          .getByRole("button", { name: /Keep here|그대로 두기/ })
          .click({ force: true });
        await page.waitForTimeout(200);
        continue;
      }
    }

    const correct = promise.getByTestId("promise-correct");
    if (await correct.isVisible().catch(() => false)) {
      await correct.click({ force: true });
      const menu = promise.getByTestId("promise-correct-menu");
      if (await menu.isVisible().catch(() => false)) {
        await menu
          .getByRole("button", { name: /Keep here|그대로 두기/ })
          .click({ force: true });
        await page.waitForTimeout(200);
        continue;
      }
    }

    break;
  }

  if (await frame.getByTestId("inline-promise").first().isVisible().catch(() => false)) {
    await forceAcknowledgeInlinePromises(page);
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
  await openContextMenuRaw(page, thoughtText);
}

export async function closeDecisionDeckIfOpen(page: Page) {
  const frame = phone(page);
  const deck = frame.getByRole("dialog", { name: "One by one" });
  if (!(await deck.isVisible().catch(() => false))) return;
  const tutorial = frame.getByTestId("swipe-tutorial");
  if (await tutorial.isVisible().catch(() => false)) {
    await tutorial.getByRole("button", { name: /Got it|알겠어요/ }).click();
  }
  await deck.getByRole("button", { name: "Close", exact: true }).click({ force: true });
  await deck.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
}

export function contextMenuDialog(page: Page) {
  // The context menu is rendered in an overlay portal, outside the device shell.
  return page.getByTestId("inbox-context-menu");
}

export async function clickContextMenuItem(page: Page, label: string) {
  const menu = contextMenuDialog(page);
  await menu.waitFor({ state: "visible" });
  await menu
    .getByRole("menuitem", { name: label, exact: true })
    .click({ force: true });
}

export async function openContextMenuRaw(page: Page, thoughtText: string) {
  const frame = phone(page);
  await dismissInlinePromise(page);
  await closeDecisionDeckIfOpen(page);
  const row = frame
    .getByTestId("left-item-row")
    .filter({ hasText: thoughtText })
    .first();
  if ((await row.count()) > 0) {
    await row.scrollIntoViewIfNeeded();
    await row.getByTestId("left-item-more").click();
    await contextMenuDialog(page).waitFor({
      state: "visible",
      timeout: 10_000,
    });
    return;
  }
  const bubble = frame
    .getByRole("paragraph")
    .filter({ hasText: thoughtText })
    .first();
  await bubble.scrollIntoViewIfNeeded();
  const box = await bubble.boundingBox();
  expect(box).toBeTruthy();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await page.mouse.up();
  await contextMenuDialog(page).waitFor({
    state: "visible",
    timeout: 10_000,
  });
}

/**
 * M2: DecisionDeck one-by-one launcher is removed from V0.2 UI.
 * Assert the menu entry is gone; do not open the deck.
 */
export async function assertDecisionDeckUnreachableFromMenu(
  page: Page,
  thoughtText?: string,
) {
  const frame = phone(page);
  await dismissInlinePromise(page);
  await closeDecisionDeckIfOpen(page);
  if (thoughtText) {
    await openContextMenuRaw(page, thoughtText);
  } else {
    const more = frame.getByTestId("left-item-more").last();
    await more.click();
    await contextMenuDialog(page).waitFor({ state: "visible", timeout: 10_000 });
  }
  const menu = contextMenuDialog(page);
  await expect(
    menu.getByRole("menuitem", { name: /Sort one by one|하나씩 정리하기/i }),
  ).toHaveCount(0);
  await expect(
    menu.getByRole("menuitem", { name: /All records|전체 기록/i }),
  ).toBeVisible();
}

/** @deprecated M2 — DecisionDeck launcher removed; use assertDecisionDeckUnreachableFromMenu. */
export async function openDecisionDeckFromMenu(
  page: Page,
  thoughtText?: string,
) {
  await assertDecisionDeckUnreachableFromMenu(page, thoughtText);
  throw new Error(
    "DecisionDeck launcher is unreachable in V0.2 UI (M2). Do not open the deck from product chrome.",
  );
}

export async function getTabCount(
  page: Page,
  tab: "Capture" | "Schedule" | "Archive",
) {
  const key =
    tab === "Capture"
      ? GUEST_INBOX_KEY
      : tab === "Schedule"
        ? GUEST_SCHEDULE_KEY
        : GUEST_ARCHIVE_KEY;
  const list = await readGuestList(page, key);
  return list.length;
}

/** Open ScheduleSheet via Calendar date → “Add on this day” (V02-05 contextual add). */
export async function openCalendarQuickAdd(
  page: Page,
  opts?: { day?: number; nextMonth?: boolean },
) {
  const frame = phone(page);
  const scheduleLink = frame
    .getByRole("link", { name: /^Schedule|일정|Schedule —|할 일·일정/ })
    .first();
  if (await scheduleLink.isVisible().catch(() => false)) {
    await scheduleLink.click();
  } else {
    await page.getByRole("link", { name: /^Schedule|일정|Schedule —|할 일·일정/ }).first().click();
  }

  const calTab = frame.getByRole("tab", { name: /Calendar|달력/ });
  const calTabPage = page.getByRole("tab", { name: /Calendar|달력/ });
  if (await calTab.isVisible().catch(() => false)) {
    await calTab.click();
  } else {
    await calTabPage.click();
  }

  if (opts?.nextMonth) {
    const next = frame.getByRole("button", { name: /Next month|다음 달/ });
    if (await next.isVisible().catch(() => false)) {
      await next.click();
    } else {
      await page.getByRole("button", { name: /Next month|다음 달/ }).click();
    }
  }

  const day =
    opts?.day ??
    (await page.evaluate(() => new Date().getDate()));
  await page.locator(`[data-cal-day="${day}"]`).first().click();

  const remember = frame.getByRole("button", {
    name: /Add on this day|이 날짜에 추가/,
  });
  if (await remember.isVisible().catch(() => false)) {
    await remember.click();
  } else {
    await page
      .getByRole("button", { name: /Add on this day|이 날짜에 추가/ })
      .click();
  }

  await page.getByRole("dialog").last().waitFor({ state: "visible" });
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
  await phone(page)
    .getByRole("button", { name: /Open settings|Settings/, exact: false })
    .click();
}

export async function openBrandHub(page: Page) {
  await gotoInbox(page);
  await phone(page)
    .getByRole("button", {
      name: /Open Itjima product information|Itjima \(잊지마\)/,
    })
    .click();
}

/** Brand hub on Home replaces the old about sheet. */
export async function openAbout(page: Page) {
  await openBrandHub(page);
}

export async function openFeedback(page: Page) {
  await openBrandHub(page);
  await page.getByRole("button", { name: "Send feedback" }).click();
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
