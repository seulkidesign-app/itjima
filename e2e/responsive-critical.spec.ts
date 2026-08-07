import { expect, test, type Page } from "@playwright/test";

const TASKS_SCHEDULE_LINK_NAME = /^Schedule — tasks and undated to-dos$/;

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

  const commitment = page.getByTestId("schedule-commitment-card");
  const clarification = page.getByTestId("inline-promise");
  await expect
    .poll(async () =>
      (await commitment.isVisible().catch(() => false)) ||
      (await clarification.isVisible().catch(() => false)),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("[critical] primary navigation, layout, and settings work at every breakpoint", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/?lang=en");

  await expect(page.getByRole("link", { name: "Capture", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator("#capture-input")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectAppControlsAreUsable(page);

  await page.getByRole("link", { name: TASKS_SCHEDULE_LINK_NAME }).click();
  await expect(page).toHaveURL(/\/schedule/);
  await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Today", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Upcoming", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Upcoming", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Calendar", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Calendar", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Archive", exact: true }).click();
  await expect(page).toHaveURL(/\/archive/);
  await expect(page.getByRole("heading", { name: "Archive", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Capture", exact: true }).click();
  const settingsButton = await openSettings(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();
  await expect(settingsButton).toBeFocused();
  await expect(settingsButton).toHaveAttribute("aria-expanded", "false");

  expect(errors).toEqual([]);
});

test("[critical] clear natural-language schedule becomes a saved schedule", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/?lang=en");

  await captureText(page, "Dentist tomorrow at 3 PM");
  const commitment = page.getByTestId("schedule-commitment-card");
  await expect(commitment).toBeVisible();
  await expect(commitment.getByTestId("commitment-title")).toContainText("Dentist");
  await expect(commitment).toHaveAttribute("data-reminder", "0");
  await commitment.getByTestId("commitment-confirm").click();
  await expect(commitment).toBeHidden();

  await page.getByRole("link", { name: TASKS_SCHEDULE_LINK_NAME }).click();
  await page.getByRole("tab", { name: "Upcoming", exact: true }).click();
  await expect(page.getByText(/Dentist/i).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  expect(errors).toEqual([]);
});

test("[critical] an ambiguous weekend plan is resolved inline without a dead end", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/?lang=en");

  await captureText(page, "Meet Maya this weekend");
  await expect(page.getByTestId("inline-promise")).toBeVisible();
  await expect(page.getByTestId("promise-confirm-saturday")).toBeVisible();
  await expect(page.getByTestId("promise-confirm-sunday")).toBeVisible();
  await page.getByTestId("promise-confirm-saturday").click();

  await page.getByRole("link", { name: TASKS_SCHEDULE_LINK_NAME }).click();
  await page.getByRole("tab", { name: "Upcoming", exact: true }).click();
  await expect(page.getByText(/Meet Maya/i).first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("[critical] manual schedule creation completes every step and can be marked done", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/schedule?lang=en");

  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add schedule" })).toBeVisible();
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await page.getByRole("button", { name: "Add time and end", exact: true }).click();
  await page.getByLabel("Schedule title").fill("Product review");
  await page.getByRole("button", { name: "Set a reminder", exact: true }).click();
  await page.getByRole("button", { name: "No reminder", exact: true }).click();
  await page.getByRole("button", { name: /Add to schedule/i }).click();

  await expect(page.getByText("Product review", { exact: true })).toBeVisible();
  await page.getByText("Product review", { exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Product review/i })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Product review/i })).toBeHidden();

  expect(errors).toEqual([]);
});

test("[critical] settings language and data controls are reachable and reversible", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/?lang=en");

  await openSettings(page);
  await page.getByRole("button", { name: "한국어", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "설정" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "설정" })).toBeHidden();

  await openSettings(page);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");

  expect(errors).toEqual([]);
});

test("[critical] attachment menu is keyboard-dismissible and returns to capture", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/?lang=en");

  const tools = page.getByRole("button", { name: "Attachment tools" });
  await tools.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(tools).toBeFocused();

  expect(errors).toEqual([]);
});

test("[critical] authentication form exposes labels, validation, and reversible modes", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/auth?lang=en");

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/enter your email/i)).toBeVisible();

  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();

  expect(errors).toEqual([]);
});

test("[critical] bilingual launch page has working CTAs and no layout overflow", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/about?lang=en");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "한국어", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();

  const openApp = page.getByRole("banner").getByRole("link", { name: "Open app" });
  await expect(openApp).toBeVisible();
  await openApp.click();
  await expect(page).toHaveURL(/\/$/);

  expect(errors).toEqual([]);
});
