import { test } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";
import {
  GUEST_ARCHIVE_KEY,
  GUEST_INBOX_KEY,
  GUEST_SCHEDULE_KEY,
  phone,
  resetAppState,
  CAPTURE_LINK_NAME,
} from "./helpers";

const OUT_DIR = join(process.cwd(), "e2e-screenshots", "design-polish");

test.describe("Design polish visual regression", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("capture V1 screens at 375px", async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true });

    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(todayStart.getHours() + 2, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 60 * 60 * 1000);
    const laterStart = new Date();
    laterStart.setDate(laterStart.getDate() + 4);
    laterStart.setHours(10, 0, 0, 0);
    const laterEnd = new Date(laterStart.getTime() + 60 * 60 * 1000);

    await resetAppState(page);
    await page.evaluate(() =>
      localStorage.setItem("itjima.swipe.tutorial.done", "1"),
    );
    await page.evaluate(
      ({
        ik,
        sk,
        ak,
        todayStartIso,
        todayEndIso,
        laterStartIso,
        laterEndIso,
        nowMs,
      }) => {
        localStorage.setItem(
          ik,
          JSON.stringify([
            {
              id: "polish-inbox-1",
              text: "Weekend brunch with friends",
              images: [],
              created_at: new Date(Date.now() - 120000).toISOString(),
            },
            {
              id: "polish-inbox-2",
              text: "Book dentist follow-up",
              images: [],
              created_at: new Date().toISOString(),
            },
          ]),
        );
        localStorage.setItem(
          sk,
          JSON.stringify([
            {
              id: "polish-today",
              text: "Pick up flowers",
              start_time: todayStartIso,
              end_time: todayEndIso,
              alarm: false,
              created_at: new Date().toISOString(),
              status: "active",
            },
            {
              id: "polish-later",
              text: "Team offsite planning",
              start_time: laterStartIso,
              end_time: laterEndIso,
              alarm: false,
              created_at: new Date().toISOString(),
              status: "active",
            },
          ]),
        );
        localStorage.setItem(
          ak,
          JSON.stringify([
            {
              id: "polish-archive-1",
              text: "Cafe startup idea near the park",
              images: [],
              created_at: new Date(nowMs - 86400000).toISOString(),
            },
            {
              id: "polish-archive-2",
              text: "Remember to call dentist",
              images: [],
              created_at: new Date(nowMs - 172800000).toISOString(),
            },
          ]),
        );
      },
      {
        ik: GUEST_INBOX_KEY,
        sk: GUEST_SCHEDULE_KEY,
        ak: GUEST_ARCHIVE_KEY,
        todayStartIso: todayStart.toISOString(),
        todayEndIso: todayEnd.toISOString(),
        laterStartIso: laterStart.toISOString(),
        laterEndIso: laterEnd.toISOString(),
        nowMs: now,
      },
    );
    await page.reload();
    await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).waitFor();

    await phone(page).screenshot({ path: join(OUT_DIR, "01-home.png") });

    await phone(page).getByTestId("left-item-more").last().click();
    await page
      .getByTestId("inbox-context-menu")
      .getByRole("menuitem", { name: "Sort one by one", exact: true })
      .click({ force: true });
    await phone(page).getByTestId("decision-deck-active-card").waitFor();
    await page.waitForTimeout(300);
    await phone(page).screenshot({ path: join(OUT_DIR, "02-decision-deck.png") });
    await phone(page).getByRole("button", { name: "Close", exact: true }).click();

    await phone(page).getByRole("link", { name: /^Schedule/ }).click();
    await phone(page).getByRole("heading", { name: "Schedule", exact: true }).waitFor();
    await phone(page).screenshot({ path: join(OUT_DIR, "03-schedule-today.png") });

    await phone(page).getByRole("tab", { name: "Upcoming" }).click();
    await page.waitForTimeout(200);
    await phone(page).screenshot({ path: join(OUT_DIR, "04-schedule-upcoming.png") });

    await phone(page).getByRole("tab", { name: "Calendar" }).click();
    await page.waitForTimeout(200);
    await phone(page).screenshot({ path: join(OUT_DIR, "05-schedule-calendar.png") });

    await phone(page).getByRole("link", { name: /^Archive/ }).click();
    await phone(page).getByRole("heading", { name: "Archive", exact: true }).waitFor();
    await phone(page).screenshot({ path: join(OUT_DIR, "06-archive-list.png") });

    await phone(page)
      .getByTestId("archive-category-filters")
      .getByRole("button", { name: "Links" })
      .click();
    await page.waitForTimeout(200);
    await phone(page).screenshot({ path: join(OUT_DIR, "07-archive-empty-filter.png") });
  });
});
