import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  phone,
  readGuestList,
  GUEST_INBOX_KEY,
  GUEST_ARCHIVE_KEY,
  GUEST_SCHEDULE_KEY,
} from "./helpers";

async function submitThought(page: Page, text: string) {
  const frame = phone(page);
  await frame.locator("textarea").first().fill(text);
  await frame.getByRole("button", { name: "Leave it", exact: true }).click();
  await frame.getByTestId("inline-promise").waitFor({ state: "visible" });
}

test.describe("Product reset IA", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("throw → inline promise → vault shows original text", async ({
    page,
  }) => {
    await submitThought(page, "Travel");
    await expect(phone(page).getByTestId("inline-promise")).toContainText(
      /idea|Saved/i,
    );
    await phone(page).getByTestId("promise-edit").click();
    await phone(page).getByRole("button", { name: "Save to vault" }).click();

    await phone(page).getByRole("link", { name: /^Vault/ }).click();
    await expect(
      phone(page).getByRole("heading", { name: "Vault", exact: true }),
    ).toBeVisible();
    await expect(phone(page).getByText("Travel").first()).toBeVisible();

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(0);
    const archive = await readGuestList(page, GUEST_ARCHIVE_KEY);
    expect(archive.length).toBe(1);
  });

  test("schedule promise keeps inbox until confirmed, then shows on Today", async ({
    page,
  }) => {
    await submitThought(page, "Dentist tomorrow at 3pm");
    await expect(phone(page).getByTestId("inline-promise")).toContainText(
      /schedule/i,
    );

    let inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(1);

    await phone(page).getByTestId("promise-primary").click();
    inbox = await readGuestList(page, GUEST_INBOX_KEY);
    expect(inbox.length).toBe(0);

    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    expect(schedules.length).toBe(1);

    await phone(page).getByRole("link", { name: /^Today/ }).click();
    await expect(phone(page).getByText(/Dentist/i).first()).toBeVisible();
  });

  test("vault list is default and can switch to thought map", async ({
    page,
  }) => {
    await page.evaluate(({ ak }) => {
      localStorage.setItem(
        ak,
        JSON.stringify([
          {
            id: "qa-map",
            text: "Map memory seed",
            images: [],
            created_at: new Date().toISOString(),
          },
        ]),
      );
    }, { ak: GUEST_ARCHIVE_KEY });
    await page.reload();
    await phone(page).getByRole("link", { name: /^Vault/ }).waitFor();

    await phone(page).getByRole("link", { name: /^Vault/ }).click();
    await expect(phone(page).getByText("Map memory seed").first()).toBeVisible();

    await phone(page).getByRole("button", { name: "Thought map" }).click();
    await expect(phone(page).getByText("Vault › Thought map")).toBeVisible();
  });
});
