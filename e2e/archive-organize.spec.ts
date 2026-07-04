import { test, expect } from "@playwright/test";
import {
  resetAppState,
  addThought,
  openContextMenu,
  phone,
} from "./helpers";

async function saveToArchive(page: import("@playwright/test").Page, text: string) {
  await addThought(page, text);
  await openContextMenu(page, text);
  await phone(page)
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(phone(page).getByText(text, { exact: true })).toHaveCount(0);
}

test.describe("Archive keyword organize", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("organize sheet describes keyword grouping, not AI similarity", async ({
    page,
  }) => {
    await saveToArchive(page, `Todo item ${Date.now()}`);
    await saveToArchive(page, `Another note ${Date.now()}`);

    await phone(page).getByRole("link", { name: /^Saved/ }).click();
    await phone(page)
      .getByRole("button", { name: "Group by keywords", exact: true })
      .click();

    const sheet = phone(page).getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Group by keywords" })).toBeVisible();
    await expect(
      sheet.getByText("We'll group by keywords in your text"),
    ).toBeVisible();
    await expect(
      sheet.getByText(/gently group similar memories/i),
    ).toHaveCount(0);
  });
});
