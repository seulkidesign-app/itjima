from pathlib import Path

path = Path("e2e/responsive-critical.spec.ts")
text = path.read_text()
old = '''  await page.getByRole("link", { name: "Archive", exact: true }).click();
  await expect(page).toHaveURL(/\\/archive/);
  await expect(page.getByRole("heading", { name: "Archive", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Capture", exact: true }).click();
'''
new = '''  await expect(page.getByRole("link", { name: "Archive", exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Capture", exact: true }).click();
'''
if old not in text:
    raise SystemExit("legacy Archive primary-nav assertion block not found")
path.write_text(text.replace(old, new, 1))
