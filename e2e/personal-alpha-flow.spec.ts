import { expect, test, type Page } from "@playwright/test";
import {
  GUEST_ARCHIVE_KEY,
  GUEST_MEMORY_KEY,
  GUEST_SCHEDULE_KEY,
  phone,
  readGuestList,
  resetAppState,
} from "./helpers";

async function seedDueThought(page: Page, text: string) {
  const now = Date.now();
  await page.evaluate(
    ({ key, thought, start, end }) => {
      localStorage.setItem(
        key,
        JSON.stringify([
          {
            id: "alpha-due",
            text: thought,
            images: ["receipt.jpg"],
            start_time: start,
            end_time: end,
            alarm: false,
            created_at: new Date(Date.now() - 120_000).toISOString(),
            status: "active",
          },
        ]),
      );
      localStorage.removeItem("itjima.guest.memories_migration");
    },
    {
      key: GUEST_SCHEDULE_KEY,
      thought: text,
      start: new Date(now - 60_000).toISOString(),
      end: new Date(now + 59 * 60_000).toISOString(),
    },
  );
  await page.reload();
  const frame = phone(page);
  await frame.getByRole("link", { name: /^Today/ }).click();
  await expect(frame.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(frame.getByText(text, { exact: true })).toBeVisible();
  return frame;
}

test.describe("Personal alpha Today actions", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("Done resolves the memory and keeps it searchable in Archive", async ({
    page,
  }) => {
    const text = "Submit the reimbursement receipt";
    const frame = await seedDueThought(page, text);
    await frame.getByRole("button", { name: "Done", exact: true }).click();
    await expect(frame.getByText(text, { exact: true })).toHaveCount(0);

    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    const archive = await readGuestList(page, GUEST_ARCHIVE_KEY);
    const memories = await readGuestList(page, GUEST_MEMORY_KEY);
    expect(schedules).toHaveLength(0);
    expect(archive).toHaveLength(1);
    expect((archive[0] as { resolution_kind: string }).resolution_kind).toBe(
      "completed",
    );
    expect((archive[0] as { images: string[] }).images).toEqual([
      "receipt.jpg",
    ]);
    expect((memories[0] as { status: string }).status).toBe("resolved");
    expect((memories[0] as { resolution_kind: string }).resolution_kind).toBe(
      "completed",
    );

    await frame.getByRole("link", { name: /^Archive/ }).click();
    await frame
      .getByPlaceholder("Find a thought you kept")
      .fill("reimbursement");
    await expect(frame.getByText(text, { exact: true }).first()).toBeVisible();
  });

  test("Tomorrow snoozes the same memory and increments its count", async ({
    page,
  }) => {
    const text = "Call the clinic back";
    const frame = await seedDueThought(page, text);
    await frame.getByRole("button", { name: "Tomorrow", exact: true }).click();
    await expect(frame.getByText(text, { exact: true })).toHaveCount(0);

    const schedules = await readGuestList(page, GUEST_SCHEDULE_KEY);
    const memories = await readGuestList(page, GUEST_MEMORY_KEY);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(schedules).toHaveLength(1);
    expect(
      new Date((schedules[0] as { start_time: string }).start_time).getDate(),
    ).toBe(tomorrow.getDate());
    expect((memories[0] as { status: string }).status).toBe("waiting");
    expect((memories[0] as { snooze_count: number }).snooze_count).toBe(1);
  });

  test("No longer needed resolves without pretending it was completed", async ({
    page,
  }) => {
    const text = "Old delivery reminder";
    const frame = await seedDueThought(page, text);
    await frame
      .getByRole("button", { name: "No longer needed", exact: true })
      .click();
    await expect(frame.getByText(text, { exact: true })).toHaveCount(0);

    const archive = await readGuestList(page, GUEST_ARCHIVE_KEY);
    const memories = await readGuestList(page, GUEST_MEMORY_KEY);
    expect((archive[0] as { resolution_kind: string }).resolution_kind).toBe(
      "no_longer_needed",
    );
    expect((memories[0] as { resolution_kind: string }).resolution_kind).toBe(
      "no_longer_needed",
    );
  });
});
