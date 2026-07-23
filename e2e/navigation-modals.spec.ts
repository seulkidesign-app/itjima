import { test, expect } from "@playwright/test";
import {
  resetAppState,
  gotoInbox,
  addThought,
  openContextMenu,
  openAbout,
  openFeedback,
  gotoArchiveListView,
  completeScheduleDialog,
  phone,
} from "./helpers";

test.describe("Navigation and modals", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("all main tabs load without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));

    await phone(page).getByRole("link", { name: /^Tasks/ }).click();
    await phone(page).getByRole("heading", { name: "Tasks" }).waitFor();
    await phone(page).getByRole("link", { name: /^Thought map/ }).click();
    await phone(page)
      .getByRole("heading", { name: "Thought map" })
      .waitFor();
    await phone(page).getByRole("link", { name: /^Thoughts/ }).click();
    await phone(page).getByText("Leave it here").waitFor();

    const ignorable = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !e.includes("Failed to load resource"),
    );
    expect(ignorable).toEqual([]);
  });

  test("about sheet opens and closes without trapping focus", async ({
    page,
  }) => {
    await openAbout(page);
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("feedback sheet opens and closes with Escape", async ({ page }) => {
    await openFeedback(page);
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("archive expand and edit title persists", async ({ page }) => {
    const text = `Title edit ${Date.now()}`;
    await addThought(page, text);

    await openContextMenu(page, text);
    await phone(page)
      .getByRole("dialog")
      .getByRole("button", { name: "Save to thought map", exact: true })
      .click();

    await gotoArchiveListView(page);
    await phone(page)
      .getByRole("button")
      .filter({ hasText: text })
      .first()
      .click();
    await phone(page).getByRole("button", { name: "Name", exact: true }).click();

    const newTitle = `Renamed ${Date.now()}`;
    await page.getByRole("dialog").locator("input").fill(newTitle);
    await page.getByRole("dialog").getByRole("button", { name: "Refine" }).click();

    await page.reload();
    await gotoArchiveListView(page);
    await phone(page).getByText(newTitle).first().waitFor({ state: "visible" });
  });

  test("schedule tabs switch without duplicate panels", async ({ page }) => {
    await phone(page).getByRole("link", { name: /^Tasks/ }).click();

    await phone(page).getByRole("tab", { name: "Today" }).click();
    await expect(phone(page).getByRole("tabpanel")).toHaveCount(1);

    await phone(page).getByRole("tab", { name: "Calendar" }).click();
    await expect(phone(page).getByRole("tabpanel")).toHaveCount(1);

    await phone(page).getByRole("tab", { name: "Upcoming" }).click();
    await expect(phone(page).getByRole("tabpanel")).toHaveCount(1);
  });

  test("feedback from about replaces about sheet and closes fully", async ({
    page,
  }) => {
    await openAbout(page);
    await page.getByRole("button", { name: "Send feedback" }).click();
    await page
      .getByRole("dialog", { name: /Contact · Feedback/ })
      .waitFor({ state: "visible" });
    await expect(page.getByText("A vault for forgotten thoughts")).toHaveCount(
      0,
    );
    await expect(page.getByRole("dialog")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("focus sort blocks tab navigation until closed", async ({ page }) => {
    await addThought(page, "First thought for sort");
    await addThought(page, "Second thought for sort");

    await phone(page).getByRole("button", { name: "One by one" }).click();
    await phone(page)
      .getByRole("dialog", { name: "One by one" })
      .waitFor({ state: "visible" });
    await expect(page).toHaveURL(/\/$/);

    await phone(page)
      .getByRole("dialog", { name: "One by one" })
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(phone(page).getByRole("dialog")).toHaveCount(0);
  });

  test("archive edit dialog blocks tab navigation until dismissed", async ({
    page,
  }) => {
    const text = `Edit overlay ${Date.now()}`;
    await addThought(page, text);
    await openContextMenu(page, text);
    await phone(page)
      .getByRole("dialog")
      .getByRole("button", { name: "Save to thought map", exact: true })
      .click();

    await gotoArchiveListView(page);
    await phone(page)
      .getByRole("button")
      .filter({ hasText: text })
      .first()
      .click();
    await phone(page).getByRole("button", { name: "Name", exact: true }).click();
    await expect(page).toHaveURL(/\/archive/);
    await phone(page).getByRole("dialog").waitFor({ state: "visible" });

    await phone(page).getByRole("dialog").click({ position: { x: 20, y: 20 } });
    await expect(phone(page).getByRole("dialog")).toHaveCount(0);
    await phone(page).getByRole("link", { name: /^Thoughts/ }).click();
    await phone(page).getByText("Leave it here").waitFor();
  });

  test("context menu blocks tab navigation until dismissed", async ({
    page,
  }) => {
    const text = `Menu overlay ${Date.now()}`;
    await addThought(page, text);
    await openContextMenu(page, text);

    await expect(phone(page).getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await phone(page).getByRole("dialog").click({ position: { x: 20, y: 20 } });
    await expect(phone(page).getByRole("dialog")).toHaveCount(0);

    await phone(page).getByRole("link", { name: /^Tasks/ }).click();
    await phone(page).getByRole("heading", { name: "Tasks" }).waitFor();
  });

  test("context menu closes when thought is removed", async ({ page }) => {
    const text = `Ghost menu ${Date.now()}`;
    await addThought(page, text);
    await openContextMenu(page, text);

    await page.evaluate(
      ({ key, thoughtText }) => {
        const items = JSON.parse(localStorage.getItem(key) || "[]") as {
          text: string;
        }[];
        localStorage.setItem(
          key,
          JSON.stringify(items.filter((i) => i.text !== thoughtText)),
        );
        window.dispatchEvent(
          new CustomEvent("itjima:update", { detail: key }),
        );
      },
      { key: "itjima.guest.inbox", thoughtText: text },
    );

    await expect(phone(page).getByRole("dialog")).toHaveCount(0);
    await phone(page).getByRole("link", { name: /^Tasks/ }).click();
    await phone(page).getByRole("heading", { name: "Tasks" }).waitFor();
  });
});
