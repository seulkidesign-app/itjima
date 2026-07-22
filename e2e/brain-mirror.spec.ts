import { test, expect } from "@playwright/test";
import {
  GUEST_ARCHIVE_KEY,
  GUEST_INBOX_KEY,
  GUEST_MEMORY_KEY,
  GUEST_SCHEDULE_KEY,
  readGuestList,
  resetAppState,
  phone,
} from "./helpers";

test.describe("AI-free Capture suggestions", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("offers a calm default without calling Brain Mirror", async ({
    page,
  }) => {
    let brainMirrorCalls = 0;
    await page.route("**/api/brain-mirror", async (route) => {
      brainMirrorCalls += 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "e2e unavailable" }),
      });
    });

    const text = "A thought with no date that I want to remember later";
    const frame = phone(page);
    await frame.locator("textarea").first().fill(text);
    await frame.getByRole("button", { name: "Leave it", exact: true }).click();

    await expect(frame.getByText("Saved safely")).toBeVisible();
    await expect(frame.getByText("Suggested moment")).toBeVisible();
    await expect(
      frame.getByRole("button", { name: "Bring it back then" }),
    ).toBeVisible();
    await expect(
      frame.getByText(
        "There was no date, so tomorrow morning is a gentle default. You can change it.",
      ),
    ).toBeVisible();
    expect(brainMirrorCalls).toBe(0);
  });

  test("approving a detected time moves one canonical memory to waiting", async ({
    page,
  }) => {
    let brainMirrorCalls = 0;
    await page.route("**/api/brain-mirror", async (route) => {
      brainMirrorCalls += 1;
      await route.fulfill({ status: 204, body: "" });
    });

    const text = "Tomorrow morning, call the clinic";
    const frame = phone(page);
    await frame.locator("textarea").first().fill(text);
    await frame.getByRole("button", { name: "Leave it", exact: true }).click();
    await frame.getByRole("button", { name: "Bring it back then" }).click();
    await expect(frame.getByText("Saved safely")).toHaveCount(0);

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    const memories = await readGuestList(page, GUEST_MEMORY_KEY);

    expect(brainMirrorCalls).toBe(0);
    expect(inbox).toHaveLength(0);
    expect(schedules).toHaveLength(1);
    expect((schedules[0] as { text: string }).text).toBe(text);
    expect(memories).toHaveLength(1);
    expect((memories[0] as { status: string }).status).toBe("waiting");
  });

  test("Archive only moves the capture to one kept memory", async ({
    page,
  }) => {
    const text = "A reference I only want to keep";
    const frame = phone(page);
    await frame.locator("textarea").first().fill(text);
    await frame.getByRole("button", { name: "Leave it", exact: true }).click();
    await frame.getByRole("button", { name: "Archive only" }).click();
    await expect(frame.getByText("Saved safely")).toHaveCount(0);

    const inbox = await readGuestList(page, GUEST_INBOX_KEY);
    const archive = await readGuestList(page, GUEST_ARCHIVE_KEY);
    const memories = await readGuestList(page, GUEST_MEMORY_KEY);
    expect(inbox).toHaveLength(0);
    expect(archive).toHaveLength(1);
    expect(memories).toHaveLength(1);
    expect((memories[0] as { status: string }).status).toBe("kept");
  });
});
