import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/components/BottomSheet.tsx"),
  "utf8",
);
const loginSheetSource = readFileSync(
  resolve(process.cwd(), "src/components/LoginSheet.tsx"),
  "utf8",
);

describe("bottom sheet accessibility contract", () => {
  it("exposes a modal dialog with a programmatic focus target", () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("ref={panelRef}");
    expect(source).toContain("tabIndex={-1}");
  });

  it("keeps Tab navigation inside the open sheet", () => {
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain("focusableElements(panel)");
    expect(source).toContain("last.focus({ preventScroll: true })");
    expect(source).toContain("first.focus({ preventScroll: true })");
  });

  it("restores focus to the control that opened the sheet", () => {
    expect(source).toContain("const previousFocus");
    expect(source).toContain("previousFocus?.isConnected");
    expect(source).toContain("previousFocus.focus({ preventScroll: true })");
  });

  it("keeps the visual backdrop out of keyboard tab order", () => {
    const backdropStart = source.indexOf("<motion.button");
    const panelStart = source.indexOf("<motion.div", backdropStart);
    const backdrop = source.slice(backdropStart, panelStart);
    expect(backdrop).toContain("tabIndex={-1}");
  });

  it("keeps sign-in inside the shared accessible modal lifecycle", () => {
    expect(loginSheetSource).toContain(
      'import { BottomSheet } from "@/components/BottomSheet"',
    );
    expect(loginSheetSource).toContain("<BottomSheet");
    expect(loginSheetSource).toContain("onClose={closeSafely}");
    expect(loginSheetSource).not.toContain('role="dialog"');
  });

  it("announces the blocking sign-in progress state", () => {
    expect(loginSheetSource).toContain('role="status"');
    expect(loginSheetSource).toContain('aria-live="polite"');
  });
});
