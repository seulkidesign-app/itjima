from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing expected block in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))

# Real accessibility fix: keep the 32px visual mic circle but expose a 44px tap target.
replace_once(
    "src/ui-quietly-organized.css",
    '''    left: 29px;\n    top: 14px;\n    width: 32px !important;\n    min-width: 32px !important;\n    height: 32px !important;\n    min-height: 32px !important;\n    background: #f3f2ef !important;\n    color: var(--ink-soft, #8a8a94) !important;\n''',
    '''    left: 23px;\n    top: 8px;\n    width: 44px !important;\n    min-width: 44px !important;\n    height: 44px !important;\n    min-height: 44px !important;\n    background: radial-gradient(circle at center, #f3f2ef 0 16px, transparent 16px) !important;\n    color: var(--ink-soft, #8a8a94) !important;\n''',
)

# Responsive matrix: mobile 319 intentionally omits Settings and Archive from primary nav.
replace_once(
    "e2e/responsive-matrix.spec.ts",
    '''    const settings = page.locator('[data-testid="open-settings"]:visible');\n    await expect(settings).toHaveCount(1);\n    await settings.click();\n    const dialog = page.getByRole("dialog", { name: "Settings" });\n    await expect(dialog).toBeVisible();\n    await page.waitForTimeout(450);\n    await expectInsideViewport(page, '.bottom-sheet-panel[role="dialog"]');\n    await page.keyboard.press("Escape");\n    await expect(dialog).toBeHidden();\n''',
    '''    const settings = page.locator('[data-testid="open-settings"]:visible');\n    if (viewport.width < 640) {\n      await expect(settings).toHaveCount(0);\n    } else {\n      await expect(settings).toHaveCount(1);\n      await settings.click();\n      const dialog = page.getByRole("dialog", { name: "Settings" });\n      await expect(dialog).toBeVisible();\n      await page.waitForTimeout(450);\n      await expectInsideViewport(page, '.bottom-sheet-panel[role="dialog"]');\n      await page.keyboard.press("Escape");\n      await expect(dialog).toBeHidden();\n    }\n''',
)
replace_once(
    "e2e/responsive-matrix.spec.ts",
    '''    await page.getByRole("link", { name: "Archive", exact: true }).click();\n    await expect(\n      page.getByRole("heading", { name: "Archive", exact: true }),\n    ).toBeVisible();\n    await expectNoHorizontalOverflow(page);\n''',
    '''    await expect(page.getByRole("link", { name: "Archive", exact: true })).toHaveCount(0);\n''',
)

# Product reset still verifies Archive behavior, but reaches the non-primary route directly.
replace_once(
    "e2e/product-reset.spec.ts",
    '''    await phone(page).getByRole("link", { name: /^Archive/ }).click();\n    await expect(\n      phone(page).getByRole("heading", { name: "Archive", exact: true }),\n    ).toBeVisible();\n''',
    '''    await page.goto("/archive?lang=en");\n    await expect(\n      phone(page).getByRole("heading", { name: "Archive", exact: true }),\n    ).toBeVisible();\n''',
)
replace_once(
    "e2e/product-reset.spec.ts",
    '''    await page.reload();\n    await phone(page).getByRole("link", { name: /^Archive/ }).click();\n    await expect(phone(page).getByText("Map memory seed").first()).toBeVisible();\n''',
    '''    await page.goto("/archive?lang=en");\n    await expect(phone(page).getByText("Map memory seed").first()).toBeVisible();\n''',
)

# Critical suite: Settings is intentionally not exposed in the mobile 319 header.
replace_once(
    "e2e/responsive-critical.spec.ts",
    '''test("[critical] primary navigation, layout, and settings work at every breakpoint", async ({\n''',
    '''test("[critical] primary navigation and layout follow the 319 breakpoint contract", async ({\n''',
)
replace_once(
    "e2e/responsive-critical.spec.ts",
    '''  await page.getByRole("link", { name: "Capture", exact: true }).click();\n  const settingsButton = await openSettings(page);\n  await page.keyboard.press("Escape");\n  await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();\n  await expect(settingsButton).toBeFocused();\n  await expect(settingsButton).toHaveAttribute("aria-expanded", "false");\n\n  expect(errors).toEqual([]);\n''',
    '''  await page.getByRole("link", { name: "Capture", exact: true }).click();\n  const viewportWidth = page.viewportSize()?.width ?? 0;\n  if (viewportWidth < 640) {\n    await expect(page.locator('[data-testid="open-settings"]:visible')).toHaveCount(0);\n  } else {\n    const settingsButton = await openSettings(page);\n    await page.keyboard.press("Escape");\n    await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();\n    await expect(settingsButton).toBeFocused();\n    await expect(settingsButton).toHaveAttribute("aria-expanded", "false");\n  }\n\n  expect(errors).toEqual([]);\n''',
)
replace_once(
    "e2e/responsive-critical.spec.ts",
    '''  const errors = collectPageErrors(page);\n  await page.goto("/app?lang=en");\n\n  await openSettings(page);\n  await page.getByRole("button", { name: "Select language" }).click();\n''',
    '''  const errors = collectPageErrors(page);\n  await page.setViewportSize({ width: 768, height: 1024 });\n  await page.goto("/app?lang=en");\n\n  await openSettings(page);\n  await page.getByRole("button", { name: "Select language" }).click();\n''',
)
replace_once(
    "e2e/responsive-critical.spec.ts",
    '''  const tools = page.getByRole("button", { name: "Attachment tools" });\n  await tools.click();\n''',
    '''  await page.locator("#capture-input").click();\n  const tools = page.getByRole("button", { name: "Attachment tools" });\n  await expect(tools).toBeVisible();\n  await tools.click();\n''',
)

# Responsive UI: Calendar is no longer a Schedule primary view.
replace_once(
    "e2e/responsive-ui.spec.ts",
    '''      for (const id of ["schedule-tab-today", "schedule-tab-list", "schedule-tab-cal"]) {\n        await expect(page.locator("#" + id)).toBeVisible();\n      }\n      await expectNoHorizontalOverflow(page);\n''',
    '''      for (const id of ["schedule-tab-today", "schedule-tab-list"]) {\n        await expect(page.locator("#" + id)).toBeVisible();\n      }\n      await expect(page.locator("#schedule-tab-cal")).toHaveCount(0);\n      await expectNoHorizontalOverflow(page);\n''',
)
replace_once(
    "e2e/responsive-ui.spec.ts",
    '''  test("desktop dialog remains inside the viewport", async ({ page }) => {\n    await page.setViewportSize({ width: 1024, height: 900 });\n    await page.goto("/schedule?lang=en");\n    await page.getByRole("tab", { name: /Calendar|달력/ }).click();\n    const today = await page.evaluate(() => new Date().getDate());\n    await page.locator(`[data-cal-day="${today}"]`).first().click();\n    await page.getByRole("button", { name: /Add on this day|이 날짜에 추가/ }).click();\n    const root = page.locator(".bottom-sheet-root");\n''',
    '''  test("desktop dialog remains inside the viewport", async ({ page }) => {\n    await page.setViewportSize({ width: 1024, height: 900 });\n    await page.goto("/app?lang=en");\n    await page.locator('[data-testid="open-settings"]:visible').click();\n    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();\n    const root = page.locator(".bottom-sheet-root");\n''',
)

# Guard against stale contracts sneaking back in this sweep.
assert "schedule-tab-cal" not in Path("e2e/responsive-ui.spec.ts").read_text().split('toHaveCount(0)')[0]
