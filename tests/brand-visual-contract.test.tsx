import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "@/components/BrandLogo";

describe("canonical Itjima brand visual contract", () => {
  it("keeps the locked landing source attached to the reusable logo", () => {
    const html = renderToStaticMarkup(<BrandLogo size="app" />);

    expect(html).toContain('data-brand-source="figma-455-33"');
    expect(html).toContain("itjima-brand-logo--app");
    expect(html).toContain("ITJIMA");
  });

  it("locks the Figma 455:33 geometry and colors in one final stylesheet", () => {
    const css = readFileSync("src/ui-brand-canonical.css", "utf8");

    expect(css).toContain("--itjima-logo-dot: #ffe658");
    expect(css).toContain("--itjima-logo-ink: #2e2e2e");
    expect(css).toContain("width: 98px");
    expect(css).toContain("height: 33px");
    expect(css).toContain("gap: 10px");
    expect(css).toContain("font-size: 21.582px");
    expect(css).toContain("letter-spacing: 0.1434px");
  });

  it("keeps product chrome on the 20px / 56px mobile baseline", () => {
    const topNav = readFileSync("src/components/TopNav.tsx", "utf8");

    expect(topNav).toContain("mobile-app-header-bar flex min-h-14");
    expect(topNav).toContain("px-5 py-0");
    expect(topNav).toContain('<BrandLogo size="app" />');
  });
});
