import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("PWA product metadata safety", () => {
  const manifestSource = read("public/manifest-v4.webmanifest");
  const manifest = JSON.parse(manifestSource) as {
    name: string;
    description: string;
    start_url?: string;
    orientation?: string;
    lang?: string;
    shortcuts?: Array<{ url: string }>;
    icons?: Array<{ src: string; sizes: string; purpose?: string }>;
  };
  const html = read("index.html");
  const brandCss = read("src/ui-brand-canonical.css");
  const shareImage = readFileSync(
    resolve(process.cwd(), "public/og-itjima-brand-v3.png"),
  );

  it("describes the released product without adding a new AI promise", () => {
    const publicMetadata = `${manifestSource}\n${html}`;
    expect(publicMetadata).not.toMatch(/AI\s*(기억|메모|일정|관리)/i);
    expect(manifest.name).toBe("잊지마");
    expect(manifest.description).toContain("애매한 부분만 확인");
  });

  it("supports both portrait and landscape without forcing orientation", () => {
    expect(manifest.orientation).toBe("any");
    expect(manifest.lang).toBe("ko-KR");
  });

  it("launches the installed PWA into the product while keeping three shortcuts", () => {
    expect(manifest.start_url).toBe("/app");
    const urls = manifest.shortcuts?.map((shortcut) => shortcut.url) ?? [];
    expect(urls).toEqual(
      expect.arrayContaining(["/app", "/schedule", "/archive"]),
    );
  });

  it("uses the approved ij launcher assets with fresh v4 URLs", () => {
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/itjima-192-v4.png",
          sizes: "192x192",
        }),
        expect.objectContaining({
          src: "/icons/itjima-512-v4.png",
          sizes: "512x512",
        }),
      ]),
    );
    expect(html).toContain('rel="manifest" href="/manifest-v4.webmanifest"');
    expect(html).toContain('href="/favicon-32-v4.png"');
    expect(html).toContain('href="/apple-touch-icon.png?v=4"');
  });

  it("keeps the lowercase wordmark on Playpen Sans Medium", () => {
    expect(brandCss).toContain("Playpen+Sans:wght@500");
    expect(brandCss).toContain('font-family: "Playpen Sans", cursive');
    expect(brandCss).toContain("font-weight: 500");
    expect(brandCss).toContain('content: "itjima"');
  });

  it("keeps search and share descriptions aligned with the focused promise", () => {
    expect(html).toContain("‘내일 3시 치과’처럼 말하거나 적어보세요");
    expect(html).toContain("애매한 부분만 확인");
    expect(html).toContain("말로 쓰는 일정 관리 앱");
    expect(html).toContain("대충 말해도 일정이 돼요");
    expect(html).toContain("og-itjima-brand-v3.png");
    expect(html).toContain('property="og:image:type" content="image/png"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
  });

  it("ships the social preview as a crawler-safe 1200 by 630 PNG", () => {
    expect(shareImage.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(shareImage.readUInt32BE(16)).toBe(1200);
    expect(shareImage.readUInt32BE(20)).toBe(630);
  });
});
