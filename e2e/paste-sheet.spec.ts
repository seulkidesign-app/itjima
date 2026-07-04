import { test, expect } from "@playwright/test";
import { resetAppState, phone, GUEST_INBOX_KEY } from "./helpers";

const PASTE_TEXT = "First pasted line\nSecond pasted line\nThird pasted line";

async function openPasteSheet(page: import("@playwright/test").Page) {
  const textarea = phone(page).locator("textarea").first();
  await textarea.focus();
  await textarea.evaluate((el, text) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      }),
    );
  }, PASTE_TEXT);

  await phone(page)
    .getByRole("dialog")
    .getByText("How should we keep this pasted text?")
    .waitFor({ state: "visible" });
}

test.describe("Paste sheet", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("keep as one saves a single thought and closes the sheet", async ({
    page,
  }) => {
    await openPasteSheet(page);

    await phone(page)
      .getByRole("button", { name: "Keep as one", exact: true })
      .click();

    await expect(phone(page).getByRole("dialog")).toHaveCount(0);
    await phone(page)
      .getByText(PASTE_TEXT, { exact: true })
      .waitFor({ state: "visible" });

    const inbox = await page.evaluate((key) => {
      return JSON.parse(localStorage.getItem(key) || "[]") as { text: string }[];
    }, GUEST_INBOX_KEY);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.text).toBe(PASTE_TEXT);
  });

  test("keep as one shows error and keeps sheet open when save fails", async ({
    page,
  }) => {
    await openPasteSheet(page);

    await page.evaluate(() => {
      (window as unknown as { __e2eBreakInboxWrite?: boolean }).__e2eBreakInboxWrite =
        true;
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (
          key.includes(".inbox") &&
          (window as unknown as { __e2eBreakInboxWrite?: boolean })
            .__e2eBreakInboxWrite
        ) {
          throw new Error("e2e simulated storage failure");
        }
        return orig.call(this, key, value);
      };
    });

    await phone(page)
      .getByRole("button", { name: "Keep as one", exact: true })
      .click();

    await page.getByText("Couldn't save").waitFor({ state: "visible" });
    await phone(page)
      .getByText("How should we keep this pasted text?")
      .waitFor({ state: "visible" });

    const inbox = await page.evaluate((key) => {
      return JSON.parse(localStorage.getItem(key) || "[]") as unknown[];
    }, GUEST_INBOX_KEY);
    expect(inbox).toHaveLength(0);
  });
});
