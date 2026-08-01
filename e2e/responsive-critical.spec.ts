import { expect, test, type Page } from "@playwright/test";

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
  await expect(page.getByTestId("inline-promise")).toBeVisible();
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

  await page.getByRole("link", { name: "Schedule", exact: true }).click();
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
  await page.getByRole("button", { name: "Add to schedule", exact: true }).click();
  await expect(page.getByTestId("inline-promise")).toBeHidden();

  await page.getByRole("link", { name: "Schedule", exact: true }).click();
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
  await expect(page.getByTestId("promise-confirm-saturday")).toBeVisible();
  await expect(page.getByTestId("promise-confirm-sunday")).toBeVisible();
  await page.getByTestId("promise-confirm-saturday").click();

  await page.getByRole("link", { name: "Schedule", exact: true }).click();
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
  await expect(page.getByRole("dialog", { name: "Remember for then" })).toBeVisible();
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await page.getByRole("button", { name: "Add time", exact: true }).click();
  await page.getByPlaceholder("What was this again?").fill("Product review");
  await page.getByRole("button", { name: "Set a reminder", exact: true }).click();
  await page.getByRole("button", { name: "Off", exact: true }).click();
  await page.getByRole("button", { name: /Add to schedule/i }).click();

  await expect(page.getByRole("dialog", { name: "Remember for then" })).toBeHidden();
  await page.getByRole("tab", { name: "Upcoming", exact: true }).click();
  const row = page.getByRole("button", { name: /Product review.*Tap to refine/i });
  await expect(row).toBeVisible();
  await row.press(" ");
  await expect(page.getByText("You can let this go", { exact: true })).toBeVisible();
  await expect(row).toBeHidden();

  expect(errors).toEqual([]);
});

test("[critical] settings language and data controls are reachable and reversible", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/?lang=en");

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
  await page.goto("/?lang=en");

  const tools = page.getByRole("button", { name: "Attachment tools" });
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
  await page.goto("/about?lang=en");

  await expect(
    page.getByRole("heading", { name: /Say the plan.*It becomes a schedule/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Capture your first plan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "See how it works" })).toHaveAttribute(
    "href",
    "#how",
  );
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Select language" }).click();
  await page.getByRole("option", { name: "한국어", exact: true }).click();
  await expect(page).toHaveURL(/lang=ko/);
  await expect(page.getByRole("link", { name: "첫 일정 남기기" })).toBeVisible();

  await page.getByRole("link", { name: "첫 일정 남기기" }).click();
  await expect(page).toHaveURL(/\/?(?:\?lang=ko)?$/);
  await expect(page.locator("#capture-input")).toBeVisible();

  expect(errors).toEqual([]);
});
