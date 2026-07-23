import { expect, test } from "@playwright/test";

const guestKey = "itjima.guest.inbox";
const backupKey = "itjima.guestBackup.inbox";
const userKey = "itjima.user-safety-test.inbox";

const item = {
  id: "guest-safety-item",
  text: "로그인 중에도 잃으면 안 되는 생각",
  images: [],
  created_at: "2026-07-23T00:00:00.000Z",
  status: "active",
};

test("backs up a guest bucket and restores it only when no user copy remains", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    ({ guestKey, backupKey, userKey, item }) => {
      localStorage.removeItem(guestKey);
      localStorage.removeItem(backupKey);
      localStorage.removeItem(userKey);
      localStorage.setItem(guestKey, JSON.stringify([item]));
    },
    { guestKey, backupKey, userKey, item },
  );

  // Reload installs the safety wrapper while the guest item already exists.
  await page.reload();
  await page.evaluate((guestKey) => localStorage.setItem(guestKey, "[]"), guestKey);

  const backup = await page.evaluate((backupKey) => localStorage.getItem(backupKey), backupKey);
  expect(JSON.parse(backup ?? "[]")).toEqual([item]);

  // A completed local transfer should keep the guest bucket empty.
  await page.evaluate(
    ({ userKey, item }) => localStorage.setItem(userKey, JSON.stringify([item])),
    { userKey, item },
  );
  await page.reload();
  await expect
    .poll(() => page.evaluate((guestKey) => localStorage.getItem(guestKey), guestKey))
    .toBe("[]");

  // If the user-scoped local copy disappears, the retained backup becomes the
  // last safe copy and is restored on the next app start.
  await page.evaluate((userKey) => localStorage.removeItem(userKey), userKey);
  await page.reload();

  const restored = await page.evaluate((guestKey) => localStorage.getItem(guestKey), guestKey);
  expect(JSON.parse(restored ?? "[]")).toEqual([item]);
});
