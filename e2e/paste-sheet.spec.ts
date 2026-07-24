import { test, expect } from "@playwright/test";
import { resetAppState, phone } from "./helpers";

const PASTE_TEXT = "First pasted line\nSecond pasted line\nThird pasted line";

test.describe("Paste sheet", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("multi-line paste does not open split sheet when disabled", async ({
    page,
  }) => {
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

    await expect(phone(page).getByRole("dialog")).toHaveCount(0);
    await expect(
      phone(page).getByText("How should we keep this pasted text?"),
    ).toHaveCount(0);

    await textarea.fill(PASTE_TEXT);
    await expect(textarea).toHaveValue(PASTE_TEXT);
  });
});
