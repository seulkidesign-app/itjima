import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("PWA product metadata safety", () => {
  const manifestSource = read("public/manifest-v7.webmanifest");
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
    resolve(process.cwd(), "public/og-itjima-brand-v7.png"),
  );

  it("keeps the installed PWA promise focused while search metadata identifies the AI product", () => {
    expect(manifest.name).toBe("잊지마");
    expect(manifest.description).toContain("애매한 부분만 확인");
    expect(html).toContain("잊지마(Itjima)");
    expect(html).toContain("AI 메모·일정 앱");
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

  it("uses the approved >ij< launcher assets and cache-busted v7 metadata URLs", () => {
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/itjima-192-v7.png",
          sizes: "192x192",
        }),
        expect.objectContaining({
          src: "/icons/itjima-512-v7.png",
          sizes: "512x512",
        }),
      ]),
    );
    expect(html).toMatch(/rel="manifest" href="\/manifest-v7\.webmanifest\?v=[^"]+"/);
    expect(html).toMatch(/rel="icon" type="image\/svg\+xml" sizes="any" href="\/favicon\.svg\?v=[^"]+"/);
    expect(html).toMatch(/rel="icon" type="image\/png" sizes="192x192" href="\/icons\/itjima-192-v7\.png\?v=[^"]+"/);
    expect(html).toMatch(/href="\/apple-touch-icon-v7\.png\?v=[^"]+"/);
  });

  it("uses the approved fixed wordmark artwork instead of a substitute font", () => {
    expect(brandCss).toContain('--itjima-wordmark-url: url("/brand/itjima-wordmark-v7.png")');
    expect(brandCss).toContain("background-image: var(--itjima-wordmark-url)");
    expect(brandCss).not.toContain("Playpen Sans");
  });

  it("keeps search and share descriptions aligned with the Itjima AI memo positioning", () => {
    expect(html).toContain("메모·할 일·일정을 구분하지 않고 자연어 한 문장으로 기록하면");
    expect(html).toContain("날짜와 행동을 읽어 자동으로 구조화");
    expect(html).toContain("잊지마(Itjima) | 자연어 AI 메모·일정 앱");
    expect(html).toContain("생각나는 대로 남기면 알아서 정리되는 AI 메모");
    expect(html).toContain("og-itjima-brand-v7.png");
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
