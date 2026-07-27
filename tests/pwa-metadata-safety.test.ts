import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("PWA product metadata safety", () => {
  const manifestSource = read("public/manifest.webmanifest");
  const manifest = JSON.parse(manifestSource) as {
    name: string;
    description: string;
    orientation?: string;
    lang?: string;
    shortcuts?: Array<{ url: string }>;
  };
  const html = read("index.html");
  const icon = read("public/favicon.svg");

  it("describes the released product as a memory inbox without AI promises", () => {
    const publicMetadata = `${manifestSource}\n${html}\n${icon}`;
    expect(publicMetadata).not.toMatch(/AI\s*(기억|메모|일정|관리)/i);
    expect(manifest.name).toContain("기억 인박스");
    expect(manifest.description).toContain("정리 없이");
    expect(manifest.description).toContain("기억 인박스");
  });

  it("supports both portrait and landscape without forcing orientation", () => {
    expect(manifest.orientation).toBe("any");
    expect(manifest.lang).toBe("ko-KR");
  });

  it("provides shortcuts for the three v1 destinations", () => {
    const urls = manifest.shortcuts?.map((shortcut) => shortcut.url) ?? [];
    expect(urls).toEqual(expect.arrayContaining(["/", "/schedule", "/archive"]));
  });

  it("includes the iOS standalone app metadata", () => {
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="잊지마"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style"');
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
  });

  it("keeps search and share descriptions aligned with the v1 promise", () => {
    expect(html).toContain("정리 없이 던져두고");
    expect(html).toContain("기억 인박스");
    expect(icon).toContain("기억 인박스 앱");
  });
});
