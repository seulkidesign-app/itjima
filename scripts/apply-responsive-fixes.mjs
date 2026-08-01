import fs from "node:fs";

function replaceRequired(text, before, after, label) {
  if (!text.includes(before)) throw new Error(`Missing source: ${label}`);
  return text.replace(before, after);
}

function update(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (before === after) throw new Error(`No changes: ${path}`);
  fs.writeFileSync(path, after);
  console.log(`Updated ${path}`);
}

update("src/components/CaptureComposer.tsx", (source) => {
  let next = source;
  next = replaceRequired(
    next,
    'className="touch-press rounded-full border border-ink/10 bg-ink/[0.035] px-3 py-1.5 text-[11px] font-semibold text-ink-soft"',
    'className="touch-press min-h-11 rounded-full border border-ink/10 bg-ink/[0.035] px-3 py-2 text-[11px] font-semibold text-ink-soft"',
    "example chip touch target",
  );
  next = replaceRequired(
    next,
    '          className="capture-submit-button flex h-10 min-w-[6rem] items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-black text-ink shadow-card disabled:bg-ink/[0.08] disabled:text-ink-soft/55 disabled:shadow-none"\n          aria-label={t("던지기", "Drop it")}',
    '          data-testid="capture-submit"\n          className="capture-submit-button flex h-11 min-h-11 min-w-[6rem] items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-black text-ink shadow-card disabled:bg-ink/[0.08] disabled:text-ink-soft/55 disabled:shadow-none"\n          aria-label={t("남기기", "Capture")}',
    "capture submit contract",
  );
  return next;
});

update("src/components/DesktopAppNav.tsx", (source) =>
  replaceRequired(
    source,
    '                onClick={tap}\n                aria-current={active ? "page" : undefined}',
    '                onClick={tap}\n                aria-label={label}\n                aria-current={active ? "page" : undefined}',
    "desktop nav name",
  ),
);

update("src/components/BottomSheet.tsx", (source) => {
  let next = source;
  next = replaceRequired(
    next,
    'function focusableElements(container: HTMLElement): HTMLElement[] {\n  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(\n    (element) =>\n      element.getAttribute("aria-hidden") !== "true" &&\n      element.getAttribute("hidden") === null,\n  );\n}\n',
    'function focusableElements(container: HTMLElement): HTMLElement[] {\n  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(\n    (element) =>\n      element.getAttribute("aria-hidden") !== "true" &&\n      element.getAttribute("hidden") === null,\n  );\n}\n\nfunction isTopmostModal(panel: HTMLElement): boolean {\n  const dialogs = Array.from(\n    document.querySelectorAll<HTMLElement>(\'[role="dialog"][aria-modal="true"]\'),\n  ).filter(\n    (dialog) => dialog.getClientRects().length > 0 && !dialog.hasAttribute("hidden"),\n  );\n  return dialogs[dialogs.length - 1] === panel;\n}\n',
    "topmost modal helper",
  );
  next = replaceRequired(
    next,
    '    const onKey = (event: KeyboardEvent) => {\n      if (event.key === "Escape") {\n        event.preventDefault();\n        onClose();\n        return;\n      }\n      if (event.key !== "Tab") return;\n\n      const panel = panelRef.current;\n      if (!panel) return;',
    '    const onKey = (event: KeyboardEvent) => {\n      const panel = panelRef.current;\n      if (!panel || !isTopmostModal(panel)) return;\n\n      if (event.key === "Escape") {\n        event.preventDefault();\n        event.stopImmediatePropagation();\n        onClose();\n        return;\n      }\n      if (event.key !== "Tab") return;',
    "nested sheet escape",
  );
  return next;
});

update("e2e/responsive-critical.spec.ts", (source) => {
  let next = source;
  next = replaceRequired(
    next,
    '    (item) => item.width < 40 || item.height < 40,',
    '    (item) => item.width < 44 || item.height < 44,',
    "44px runtime gate",
  );
  next = replaceRequired(
    next,
    '  await page.getByRole("button", { name: "Capture", exact: true }).click();',
    '  await page.getByTestId("capture-submit").click();',
    "capture locator",
  );
  next = replaceRequired(
    next,
    '  await row.press(" ");\n  await expect(page.getByText("Product review", { exact: true }).first()).toBeVisible();',
    '  await row.press(" ");\n  await expect(page.getByText("You can let this go", { exact: true })).toBeVisible();\n  await expect(row).toBeHidden();',
    "completion feedback",
  );
  return next;
});
