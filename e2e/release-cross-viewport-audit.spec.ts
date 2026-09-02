import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "compact phone", width: 320, height: 568 },
  { name: "standard phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function reset(page: Page, rediscovery = false) {
  await page.goto("/");
  await page.evaluate((enabled) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("itjima_lang", "en");
    if (enabled) {
      localStorage.setItem(
        "itjima.__feature_overrides__",
        JSON.stringify({ REDISCOVERY: true }),
      );
    }
  }, rediscovery);
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(metrics.document, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.body, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.viewport + 1);
}

async function expectFitsViewportWidth(page: Page, locator: ReturnType<Page["locator"]>) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(-2);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 2);
}

for (const viewport of viewports) {
  test(`[release layout] ${viewport.name} can complete a schedule with a normal click`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await reset(page);

    await page.evaluate(() => {
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      start.setHours(15, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      localStorage.setItem(
        "itjima.guest.schedules",
        JSON.stringify([
          {
            id: "release-audit-schedule",
            source_id: "release-audit-record",
            text: "Release audit appointment",
            raw_text: "Release audit appointment",
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            alarm: false,
            status: "active",
            created_at: new Date().toISOString(),
          },
        ]),
      );
      localStorage.setItem(
        "itjima.guest.inbox",
        JSON.stringify([
          {
            id: "release-audit-record",
            text: "Release audit appointment",
            raw_text: "Release audit appointment",
            images: [],
            status: "active",
            temporal_state: "exact_datetime",
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            created_at: new Date().toISOString(),
          },
        ]),
      );
    });

    await page.goto("/schedule");
    await expect(page.getByText("Release audit appointment").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const complete = page.getByTestId("schedule-row-complete").first();
    await complete.scrollIntoViewIfNeeded();
    await expect(complete).toBeVisible();
    await complete.click();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const rows = JSON.parse(localStorage.getItem("itjima.guest.schedules") || "[]") as Array<{
            id?: string;
            status?: string;
          }>;
          return rows.find((row) => row.id === "release-audit-schedule")?.status;
        }),
      )
      .toBe("done");
    await expectNoHorizontalOverflow(page);
  });

  test(`[release layout] ${viewport.name} keeps enabled Rediscovery usable`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await reset(page, true);
    await page.evaluate(() => {
      localStorage.setItem(
        "itjima.guest.inbox",
        JSON.stringify([
          {
            id: "release-audit-rediscovery",
            text: "A useful older thought to revisit",
            raw_text: "A useful older thought to revisit",
            images: [],
            status: "active",
            temporal_state: "no_time",
            created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
          },
        ]),
      );
      localStorage.setItem("itjima.guest.schedules", JSON.stringify([]));
      localStorage.setItem("itjima.guest.archive", JSON.stringify([]));
    });

    await page.goto("/rediscovery");
    await expect(page.getByRole("heading", { name: "A useful older thought to revisit" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    for (const button of [
      page.getByRole("button", { name: "View record" }),
      page.getByRole("button", { name: "Later" }),
      page.getByRole("button", { name: "Don't show this again" }),
    ]) {
      await button.scrollIntoViewIfNeeded();
      await expectFitsViewportWidth(page, button);
    }
  });

  test(`[release layout] ${viewport.name} keeps browse and organize sheets usable`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await reset(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "itjima.guest.inbox",
        JSON.stringify([
          {
            id: "release-audit-note",
            text: "A note that should stay easy to browse",
            raw_text: "A note that should stay easy to browse",
            images: [],
            status: "active",
            temporal_state: "no_time",
            created_at: new Date().toISOString(),
          },
        ]),
      );
    });

    await page.goto("/app?lang=en");
    const browseEntry = page
      .getByRole("button", { name: "Search records" })
      .filter({ visible: true })
      .first();
    await browseEntry.scrollIntoViewIfNeeded();
    await expect(browseEntry).toBeVisible();
    await browseEntry.click();

    const browse = page.getByTestId("records-browse-sheet");
    await expect(browse).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectFitsViewportWidth(page, browse);

    const search = page.getByTestId("records-browse-search");
    await search.fill("easy to browse");
    await expect(page.getByTestId("records-browse-row")).toContainText(
      "A note that should stay easy to browse",
    );

    const organizeEntry = page.getByTestId("records-browse-organize");
    await organizeEntry.scrollIntoViewIfNeeded();
    await expect(organizeEntry).toBeVisible();
    await organizeEntry.click();

    const organize = page.getByTestId("organize-summary-sheet");
    await expect(organize).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectFitsViewportWidth(page, organize);

    for (const testId of [
      "organize-tile-schedule",
      "organize-tile-todo",
      "organize-tile-thought",
      "organize-tile-confirm",
    ]) {
      const tile = page.getByTestId(testId);
      await tile.scrollIntoViewIfNeeded();
      await expect(tile).toBeVisible();
    }
  });
}
