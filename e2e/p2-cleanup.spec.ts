import { test, expect, type Page } from "@playwright/test";
import { GUEST_INBOX_KEY, phone, resetAppState } from "./helpers";

async function seedCleanupRecords(page: Page) {
  await page.evaluate((key) => {
    const row = (id: string, text: string, createdAt: string) => ({
      id,
      text,
      raw_text: text,
      images: [],
      created_at: createdAt,
      status: "active",
      temporal_state: "no_time",
      clarification_state: null,
      start_time: null,
      end_time: null,
      structured_at: null,
    });

    localStorage.setItem(
      key,
      JSON.stringify([
        row("dup-new", "서울숲 카페 가보기", "2026-08-30T02:00:00.000Z"),
        row("dup-old", "서울숲 카페 가보기", "2026-08-30T01:00:00.000Z"),
        row("short-note", "hi", "2026-08-29T23:00:00.000Z"),
        row("old-important", "몇 달 뒤에도 기억할 생각", "2025-01-01T00:00:00.000Z"),
      ]),
    );
  }, GUEST_INBOX_KEY);
  await page.reload();
  await phone(page).getByTestId("left-items-section").waitFor({ state: "visible" });
}

async function openCleanup(page: Page) {
  const frame = phone(page);
  await frame.getByTestId("left-item-more").first().click();
  await frame.getByRole("menuitem", { name: "Review duplicates" }).click();
  await frame.getByTestId("cleanup-review-sheet").waitFor({ state: "visible" });
}

async function readStatuses(page: Page) {
  return page.evaluate((key) => {
    const items = JSON.parse(localStorage.getItem(key) || "[]") as Array<{
      id: string;
      status?: string;
    }>;
    return Object.fromEntries(items.map((item) => [item.id, item.status]));
  }, GUEST_INBOX_KEY);
}

test.describe("P2 safe cleanup", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await seedCleanupRecords(page);
  });

  test("opening cleanup never deletes or preselects records", async ({ page }) => {
    await openCleanup(page);
    const frame = phone(page);
    const sheet = frame.getByTestId("cleanup-review-sheet");

    await expect(frame.getByTestId("cleanup-duplicate-group")).toHaveCount(1);
    await expect(frame.getByTestId("cleanup-copy-row")).toHaveCount(2);
    await expect(sheet).toContainText("서울숲 카페 가보기");
    await expect(sheet.getByText("hi", { exact: true })).toHaveCount(0);
    await expect(sheet.getByText("몇 달 뒤에도 기억할 생각", { exact: true })).toHaveCount(0);
    await expect(frame.getByRole("button", { name: /delete all|let go/i })).toHaveCount(0);

    const statuses = await readStatuses(page);
    expect(statuses["dup-new"]).toBe("active");
    expect(statuses["dup-old"]).toBe("active");
    expect(statuses["old-important"]).toBe("active");
  });

  test("cancelling delete confirmation keeps every record", async ({ page }) => {
    await openCleanup(page);
    const frame = phone(page);

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Delete only this copy");
      await dialog.dismiss();
    });
    await frame.getByTestId("cleanup-delete-dup-old").click();

    await expect.poll(() => readStatuses(page)).toMatchObject({
      "dup-new": "active",
      "dup-old": "active",
      "short-note": "active",
      "old-important": "active",
    });
    await expect(frame.getByTestId("cleanup-duplicate-group")).toHaveCount(1);
  });

  test("confirmed delete removes only the chosen duplicate copy", async ({ page }) => {
    await openCleanup(page);
    const frame = phone(page);

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Delete only this copy");
      await dialog.accept();
    });
    await frame.getByTestId("cleanup-delete-dup-old").click();

    await expect.poll(() => readStatuses(page)).toMatchObject({
      "dup-new": "active",
      "dup-old": "deleted",
      "short-note": "active",
      "old-important": "active",
    });

    await expect(frame.getByTestId("cleanup-empty")).toBeVisible();
    await expect(frame.getByTestId("cleanup-duplicate-group")).toHaveCount(0);
  });
});
