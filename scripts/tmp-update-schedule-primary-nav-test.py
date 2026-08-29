from pathlib import Path

path = Path("e2e/responsive-critical.spec.ts")
text = path.read_text()
old = '''  await page.getByRole("tab", { name: "Calendar", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Calendar", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
'''
new = '''  await expect(page.getByRole("tab", { name: "Calendar", exact: true })).toHaveCount(0);
'''
if old not in text:
    raise SystemExit("legacy Calendar-tab assertion block not found")
path.write_text(text.replace(old, new, 1))
