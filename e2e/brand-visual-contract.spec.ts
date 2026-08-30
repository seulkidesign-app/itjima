import { expect, test, type Page } from "@playwright/test";

async function openForVisualContract(page: Page, path: string) {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  let body = (await page.locator("body").innerText()).slice(0, 500);
  const showError = page.getByRole("button", { name: "Show Error" });
  if (await showError.isVisible().catch(() => false)) {
    await showError.click();
    body = (await page.locator("body").innerText()).slice(0, 1800);
  }
  console.log(
    "VISUAL_CONTRACT_PAGE",
    JSON.stringify({
      requested: path,
      status: response?.status() ?? null,
      url: page.url(),
      title: await page.title(),
      body,
      pageErrors,
    }),
  );
}

test.describe("locked landing brand visual contract", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile app chrome uses the canonical logo and 20/56 baseline", async ({
    page,
  }) => {
    await openForVisualContract(page, "/app");

    const header = page.locator(".mobile-app-header-bar");
    const logo = page.locator(
      '.mobile-app-header-bar [data-testid="brand-logo"]',
    );
    const search = page.getByTestId("open-browse-search");
    const settings = page.getByTestId("open-settings").first();

    await expect(header).toBeVisible();
    await expect(logo).toBeVisible();

    const [headerBox, logoBox, searchBox, settingsBox] = await Promise.all([
      header.boundingBox(),
      logo.boundingBox(),
      search.boundingBox(),
      settings.boundingBox(),
    ]);

    expect(headerBox).not.toBeNull();
    expect(logoBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(settingsBox).not.toBeNull();

    expect(headerBox!.height).toBeCloseTo(56, 0);
    expect(logoBox!.width).toBeCloseTo(71.273, 0);
    expect(logoBox!.height).toBeCloseTo(24, 0);
    expect(logoBox!.x - headerBox!.x).toBeCloseTo(20, 0);
    expect(searchBox!.width).toBeCloseTo(44, 0);
    expect(searchBox!.height).toBeCloseTo(44, 0);
    expect(settingsBox!.width).toBeCloseTo(44, 0);
    expect(settingsBox!.height).toBeCloseTo(44, 0);

    await expect(logo).toHaveAttribute("data-brand-source", "figma-455-33");
  });

  test("landing header renders the exact 455:33 logo metrics", async ({ page }) => {
    await openForVisualContract(page, "/");

    const wordmark = page.locator(".landing-motion-wordmark");
    const word = wordmark.locator(":scope > span:first-child");
    await expect(wordmark).toBeVisible();

    const metrics = await wordmark.evaluate((element) => {
      const dot = getComputedStyle(element, "::before");
      const text = getComputedStyle(element.querySelector("span")!);
      return {
        dotWidth: dot.width,
        dotHeight: dot.height,
        dotColor: dot.backgroundColor,
        gap: getComputedStyle(element).gap,
        fontFamily: text.fontFamily,
        fontSize: text.fontSize,
        fontWeight: text.fontWeight,
        letterSpacing: text.letterSpacing,
        color: text.color,
      };
    });

    expect(metrics.dotWidth).toBe("14px");
    expect(metrics.dotHeight).toBe("14px");
    expect(metrics.dotColor).toBe("rgb(255, 230, 88)");
    expect(metrics.gap).toBe("10px");
    expect(metrics.fontFamily).toContain("Playpen Sans");
    expect(metrics.fontSize).toBe("21.582px");
    expect(metrics.fontWeight).toBe("400");
    expect(parseFloat(metrics.letterSpacing)).toBeCloseTo(0.1434, 2);
    expect(metrics.color).toBe("rgb(46, 46, 46)");
    await expect(word).toHaveText("ITJIMA");
  });
});
