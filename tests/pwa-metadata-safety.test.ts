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
  const shareImage = readFileSync(
    resolve(process.cwd(), "public/og-itjima-schedule-v2.png"),
  );

  it("describes the released product as natural-language schedule capture without AI promises", () => {
    const publicMetadata = `${manifestSource}\n${html}\n${icon}`;
    expect(publicMetadata).not.toMatch(/AI\s*(기억|메모|일정|관리)/i);
    expect(manifest.name).toContain("일정 캡처");
    expect(manifest.description).toContain("자연어");
    expect(manifest.description).toContain("애매한 부분만 확인");
  });

  it("supports both portrait and landscape without forcing orientation", () => {
    expect(manifest.orientation).toBe("any");
    expect(manifest.lang).toBe("ko-KR");
  });

  it("provides shortcuts for the three v1 destinations", () => {
    const urls = manifest.shortcuts?.map((shortcut) => shortcut.url) ?? [];
    expect(urls).toEqual(
      expect.arrayContaining(["/", "/schedule", "/archive"]),
    );
  });

  it("includes the iOS standalone app metadata", () => {
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain(
      'name="apple-mobile-web-app-title" content="잊지마"',
    );
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style"');
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
  });

  it("keeps search and share descriptions aligned with the focused promise", () => {
    expect(html).toContain("자연어로 말하듯 남기면");
    expect(html).toContain("애매한 부분만 확인");
    expect(html).toContain("말하듯 남기는 일정 캡처");
    expect(html).toContain("og-itjima-schedule-v2.png");
    expect(html).toContain('property="og:image:type" content="image/png"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(icon).toContain("자연어 일정 캡처 도구");
  });

  it("ships the social preview as a crawler-safe 1200 by 630 PNG", () => {
    expect(shareImage.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(shareImage.readUInt32BE(16)).toBe(1200);
    expect(shareImage.readUInt32BE(20)).toBe(630);
  });
});
