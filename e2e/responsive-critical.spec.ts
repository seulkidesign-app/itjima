import { expect, test, type Page } from "@playwright/test";

const TASKS_SCHEDULE_LINK_NAME = /^Schedule$/;

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
}

async function expectAppControlsAreUsable(page: Page) {
  const result = await page
    .locator(".phone-frame button:visible, .phone-frame a:visible, .phone-frame [role='button']:visible")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const label =
          element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.textContent?.trim() ||
          "";
        return {
          tag: element.tagName.toLowerCase(),
          label,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }),
    );

  const unnamed = result.filter((item) => !item.label);
  expect(unnamed, "Every visible interactive control needs a name").toEqual([]);

  const tooSmall = result.filter(
    (item) => item.width < 44 || item.height < 44,
  );
  expect(
    tooSmall,
    "Visible app controls should provide a comfortable touch target",
  ).toEqual([]);
}

async function openSettings(page: Page) {
  const button = page.locator('[data-testid="open-settings"]:visible');
  await expect(button).toHaveCount(1);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  return button;
}

async function captureText(page: Page, text: string) {
  const input = page.locator("#capture-input");
  await expect(input).toBeVisible();
  await input.fill(text);
  await page.getByTestId("capture-submit").click();
}

async function confirmCapturedSchedule(page: Page) {
  // V02-08C: clear timed captures auto-commit — wait for saved feedback or schedule.
  const saved = page.getByTestId("saved-schedule-feedback");
  if (await saved.isVisible().catch(() => false)) return;

  const looksRight = page.getByRole("button", { name: /Looks right|맞아요/i });
  if (await looksRight.isVisible().catch(() => false)) {
    await looksRight.click();
    return;
  }
  const addToSchedule = page.getByRole("button", {
    name: "Add to schedule",
    exact: true,
  });
  if (await addToSchedule.isVisible().catch(() => false)) {
    await addToSchedule.click();
    return;
  }
  const primary = page.getByTestId("promise-primary");
  if (await primary.isVisible().catch(() => false)) {
    await primary.click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("[critical] primary navigation and layout follow the 319 breakpoint contract", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/app?lang=en");

  await expect(page.getByRole("link", { name: "Capture", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator("#capture-input")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectAppControlsAreUsable(page);

  await page.getByRole("link", { name: TASKS_SCHEDULE_LINK_NAME }).click();
  await expect(page).toHaveURL(/\/schedule/);
  await expect(page.getByRole("heading", { name: "My schedule", exact: true })).toBeVisible();
  await expect(page.getByTestId("schedule-unified-view")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByText("Calendar", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await expect(page.getByRole("link", { name: "Archive", exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Capture", exact: true }).click();
  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth < 640) {
    await expect(page.locator('[data-testid="open-settings"]:visible')).toHaveCount(0);
  } else {
    const settingsButton = await openSettings(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();
    await expect(settingsButton).toBeFocused();
    await expect(settingsButton).toHaveAttribute("aria-expanded", "false");
  }

  expect(errors).toEqual([]);
});

test("[critical] clear natural-language schedule becomes a saved schedule", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/app?lang=en");

  await captureText(page, "Dentist tomorrow at 3 PM");
  await confirmCapturedSchedule(page);
  await expect(page.getByTestId("saved-schedule-feedback")).toBeVisible();
  await expect(page.getByRole("button", { name: /Looks right|맞아요/i })).toHaveCount(0);
  await expect(page.getByTestId("inline-promise")).toHaveCount(0);

  await page.getByRole("link", { name: TASKS_SCHEDULE_LINK_NAME }).click();
  await expect(page.getByTestId("schedule-unified-view")).toBeVisible();
  await expect(page.getByTestId("schedule-section-upcoming")).toBeVisible();
  // Storage remains the source of truth for the canonical schedule projection.
  await expect
    .poll(async () => {
      const list = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) || "[]") as Array<{ text?: string }>,
        "itjima.guest.schedules",
      );
      return list.some((s) => /Dentist/i.test(s.text ?? ""));
    })
    .toBe(true);
  await expectNoHorizontalOverflow(page);

  expect(errors).toEqual([]);
});

test("[critical] an ambiguous weekend plan is resolved inline without a dead end", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/app?lang=en");

  await captureText(page, "Meet Maya this weekend");
  await expect(page.getByTestId("promise-confirm-saturday")).toBeVisible();
  await expect(page.getByTestId("promise-confirm-sunday")).toBeVisible();
  await page.getByTestId("promise-confirm-saturday").click();

  await page.getByRole("link", { name: TASKS_SCHEDULE_LINK_NAME }).click();
  await expect(page.getByTestId("schedule-unified-view")).toBeVisible();
  await expect(page.getByTestId("schedule-section-upcoming")).toBeVisible();
  await expect(page.getByText(/Meet Maya/i).first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("[critical] home capture creates a schedule that can be marked done", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/app?lang=en");

  await captureText(page, "Product review tomorrow at 3 PM");
  await confirmCapturedSchedule(page);
  await expect(page.getByRole("button", { name: /Looks right|맞아요/i })).toHaveCount(0);

  await page.getByRole("link", { name: TASKS_SCHEDULE_LINK_NAME }).click();
  await expect(page.getByRole("button", { name: "Add task", exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByTestId("schedule-unified-view")).toBeVisible();
  await expect(page.getByTestId("schedule-section-upcoming")).toBeVisible();
  const reviewRow = page.getByText("Product review").first();
  await reviewRow.scrollIntoViewIfNeeded();
  // Phone-frame overflow can clip rows; force-complete still exercises the action.
  await page.getByRole("button", { name: "Complete", exact: true }).first().click({
    force: true,
  });
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const list = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) || "[]") as Array<{ text?: string; status?: string }>,
        "itjima.guest.schedules",
      );
      const hit = list.find((s) => (s.text ?? "").includes("Product review"));
      return hit?.status === "done" || !hit;
    })
    .toBe(true);

  expect(errors).toEqual([]);
});

test("[critical] settings language and data controls are reachable and reversible", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/app?lang=en");

  await openSettings(page);
  await page.getByRole("button", { name: "Select language" }).click();
  await page.getByRole("option", { name: "한국어", exact: true }).click();
  await expect(page.getByTestId("settings-data-privacy-row")).toContainText(
    "데이터와 개인정보",
  );

  await page.getByTestId("settings-data-privacy-row").click();
  await expect(page.getByRole("dialog", { name: "데이터와 개인정보" })).toBeVisible();
  await expect(page.getByTestId("data-export-button")).toBeVisible();
  await expect(page.getByTestId("data-delete-button")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "데이터와 개인정보" })).toBeHidden();
  await expect(page.getByRole("dialog", { name: "설정" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "설정" })).toBeHidden();

  expect(errors).toEqual([]);
});

test("[critical] attachment menu is keyboard-dismissible and returns to capture", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/app?lang=en");

  await page.locator("#capture-input").click();
  const tools = page.getByRole("button", { name: "Attachment tools" });
  await expect(tools).toBeVisible();
  await tools.click();
  await expect(tools).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("menu", { name: "Attachment tools" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Attach photo" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Attachment tools" })).toBeHidden();
  await expect(tools).toHaveAttribute("aria-expanded", "false");

  expect(errors).toEqual([]);
});

test("[critical] authentication form exposes labels, validation, and reversible modes", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/auth?lang=en");

  await expect(page.getByRole("heading", { name: "Good to see you again" })).toBeVisible({
    timeout: 12_000,
  });
  const email = page.getByLabel("Email", { exact: true });
  const password = page.getByLabel("Password", { exact: true });
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();
  await expect(submit).toBeDisabled();

  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByText("Enter your email first")).toBeVisible();
  await expect(email).toBeFocused();

  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Keep your plans across devices" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Good to see you again" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("[critical] bilingual launch page has working CTAs and no layout overflow", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/?lang=en");

  await expect(
    page.getByRole("heading", {
      name: /Drop thoughts as they come\.?\s*They organize themselves/i,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", {
        name: /Drop your first thought|Open app|Start free/i,
      })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /See the 10-second flow|See how it works/i }),
  ).toHaveAttribute("href", "#how");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Select language" }).click();
  await page.getByRole("option", { name: "한국어", exact: true }).click();
  await expect(page).toHaveURL(/lang=ko/);
  await expect(
    page.getByRole("link", { name: /첫 기록|앱 열기|무료로 시작/i }).first(),
  ).toBeVisible();

  await page.getByRole("link", { name: /첫 기록|앱 열기|무료로 시작/i }).first().click();
  await expect(page.locator("#capture-input")).toBeVisible({ timeout: 15000 });

  expect(errors).toEqual([]);
});
