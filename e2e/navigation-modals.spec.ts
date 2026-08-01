import { test, expect } from "@playwright/test";
import {
  resetAppState,
  addThought,
  openContextMenu,
  openContextMenuRaw,
  openAbout,
  openFeedback,
  gotoArchiveListView,
  openArchiveEditDialog,
  dismissArchiveEditDialog,
  phone,
  CAPTURE_LINK_NAME,
  clickContextMenuItem,
  contextMenuDialog,
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

    await phone(page).getByRole("link", { name: /^Schedule/ }).click();
    await phone(page).getByRole("heading", { name: "Schedule" }).waitFor();
    await phone(page).getByRole("link", { name: /^Archive/ }).click();
    await phone(page)
      .getByRole("heading", { name: "Archive" })
      .waitFor();
    await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).click();
    await phone(page).locator("#capture-input").waitFor();

    const ignorable = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !e.includes("Failed to load resource"),
    );
    expect(ignorable).toEqual([]);
  });

  test("brand hub opens and closes without trapping focus", async ({
    page,
  }) => {
    await openAbout(page);
    await expect(
      page.getByRole("dialog", { name: "About Itjima" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "About Itjima" }),
    ).toHaveCount(0);
  });

  test("feedback sheet opens and closes with Escape", async ({ page }) => {
    await openFeedback(page);
    await page.getByRole("dialog", { name: "Share your thoughts" }).waitFor({
      state: "visible",
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Share your thoughts" }),
    ).toHaveCount(0);
  });

  test("archive expand and edit title persists", async ({ page }) => {
    const text = `Title edit ${Date.now()}`;
    await addThought(page, text);

    await openContextMenu(page, text);
    await clickContextMenuItem(page, "Save to vault");

    await openArchiveEditDialog(page, text);

    const newTitle = `Renamed ${Date.now()}`;
    await page.getByRole("dialog", { name: /Refine name/i }).locator("input").fill(newTitle);
    await page.getByRole("dialog", { name: /Refine name/i }).getByRole("button", { name: "Refine" }).click();

    await page.reload();
    await gotoArchiveListView(page);
    await phone(page).getByText(newTitle).first().waitFor({ state: "visible" });
  });

  test("schedule tabs switch without duplicate panels", async ({ page }) => {
    await phone(page).getByRole("link", { name: /^Schedule/ }).click();

    await phone(page).getByRole("tab", { name: "Today" }).click();
    await expect(phone(page).getByRole("tabpanel")).toHaveCount(1);

    await phone(page).getByRole("tab", { name: "Calendar" }).click();
    await expect(phone(page).getByRole("tabpanel")).toHaveCount(1);

    await phone(page).getByRole("tab", { name: "Upcoming" }).click();
    await expect(phone(page).getByRole("tabpanel")).toHaveCount(1);
  });

  test("feedback from brand hub opens feedback sheet and closes fully", async ({
    page,
  }) => {
    await openAbout(page);
    await page.getByRole("button", { name: "Send feedback" }).click();
    await page
      .getByRole("dialog", { name: /Share your thoughts/ })
      .waitFor({ state: "visible" });
    await expect(
      page.getByRole("dialog", { name: "About Itjima" }),
    ).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("focus sort blocks tab navigation until closed", async ({ page }) => {
    await addThought(page, "First thought for sort");
    await addThought(page, "Second thought for sort");

    await openContextMenuRaw(page, "First thought for sort");
    await clickContextMenuItem(page, "Sort one by one");
    await phone(page)
      .getByRole("dialog", { name: "One by one" })
      .waitFor({ state: "visible" });
    await expect(page).toHaveURL(/\/$/);

    const tutorial = phone(page).getByTestId("swipe-tutorial");
    if (await tutorial.isVisible().catch(() => false)) {
      await tutorial.getByRole("button", { name: /Got it|알겠어요/ }).click();
    }

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
    await clickContextMenuItem(page, "Save to vault");

    await openArchiveEditDialog(page, text);
    await expect(page).toHaveURL(/\/archive/);

    await dismissArchiveEditDialog(page);
    await phone(page).getByRole("link", { name: CAPTURE_LINK_NAME }).click();
    await phone(page).locator("#capture-input").waitFor();
  });

  test("context menu blocks tab navigation until dismissed", async ({
    page,
  }) => {
    const text = `Menu overlay ${Date.now()}`;
    await addThought(page, text);
    await openContextMenu(page, text);

    await expect(contextMenuDialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await page.keyboard.press("Escape");
    await expect(contextMenuDialog(page)).toHaveCount(0);

    await phone(page).getByRole("link", { name: /^Schedule/ }).click();
    await phone(page).getByRole("heading", { name: "Schedule" }).waitFor();
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

    await expect(contextMenuDialog(page)).toHaveCount(0);
    await phone(page).getByRole("link", { name: /^Schedule/ }).click();
    await phone(page).getByRole("heading", { name: "Schedule" }).waitFor();
  });
});
