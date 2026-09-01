import { test, expect, type Page } from "@playwright/test";
import {
  phone,
  GUEST_INBOX_KEY,
  GUEST_ARCHIVE_KEY,
  readGuestList,
  openContextMenuRaw,
  clickContextMenuItem,
} from "./helpers";

type InboxRow = {
  id: string;
  text: string;
  raw_text?: string | null;
  created_at: string;
  status?: string;
  temporal_state?: string | null;
  content_revision?: number;
};

type ArchiveRow = {
  id: string;
  source_id?: string | null;
  text: string;
  raw_text?: string | null;
};

async function resetKo(page: Page) {
  await page.goto("/app");
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("itjima.")) localStorage.removeItem(key);
    }
    localStorage.setItem("itjima_lang", "ko");
    localStorage.setItem("itjima.swipe.tutorial.done", "1");
    sessionStorage.clear();
  });
  await page.reload();
  await phone(page).getByRole("link", { name: /^남기기$/ }).waitFor();
}

async function submit(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame
    .getByRole("button", { name: /^(남기기|던지기)$/, exact: false })
    .click();
}

async function inboxRows(page: Page) {
  return (await readGuestList(page, GUEST_INBOX_KEY)) as InboxRow[];
}

async function archiveRows(page: Page) {
  return (await readGuestList(page, GUEST_ARCHIVE_KEY)) as ArchiveRow[];
}

test.describe("Archive undo identity", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await resetKo(page);
  });

  test("archive → undo → reload restores the same canonical record", async ({
    page,
  }) => {
    const text = "회의에서 나온 접근성 아이디어 정리";
    await submit(page, text);

    const before = (await inboxRows(page)).find((row) => row.text === text);
    expect(before).toBeTruthy();
    expect(before?.raw_text).toBe(text);

    await openContextMenuRaw(page, text);
    await clickContextMenuItem(page, "보관함에 맡기기");

    await expect.poll(async () => (await archiveRows(page)).length).toBe(1);
    expect((await inboxRows(page)).some((row) => row.id === before?.id)).toBe(false);
    const archived = (await archiveRows(page))[0];
    expect(archived?.source_id).toBe(before?.id);
    expect(archived?.raw_text).toBe(text);

    const undo = page.getByRole("button", { name: "되돌리기", exact: true }).last();
    await expect(undo).toBeVisible();
    await undo.click();

    await expect.poll(async () => (await archiveRows(page)).length).toBe(0);
    await expect.poll(async () => (await inboxRows(page)).length).toBe(1);

    const restored = (await inboxRows(page))[0];
    expect(restored?.id).toBe(before?.id);
    expect(restored?.text).toBe(before?.text);
    expect(restored?.raw_text).toBe(before?.raw_text);
    expect(restored?.created_at).toBe(before?.created_at);
    expect(restored?.temporal_state ?? "no_time").toBe(
      before?.temporal_state ?? "no_time",
    );
    expect(restored?.content_revision ?? 0).toBe(before?.content_revision ?? 0);

    await page.reload();
    await phone(page).getByRole("link", { name: /^남기기$/ }).waitFor();
    const afterReload = (await inboxRows(page)).filter(
      (row) => row.id === before?.id,
    );
    expect(afterReload).toHaveLength(1);
    expect(afterReload[0]?.raw_text).toBe(text);
    expect(await archiveRows(page)).toHaveLength(0);
  });
});
