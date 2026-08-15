import { afterEach, describe, expect, it } from "vitest";
import { applyLandingSeo, landingStructuredDataGraph } from "@/lib/seo";

afterEach(() => {
  document.head.innerHTML = "";
  document.documentElement.lang = "";
});

function metaContent(selector: string): string | null {
  return document.querySelector<HTMLMetaElement>(selector)?.content ?? null;
}

describe("launch SEO localization", () => {
  it("publishes an English title, description, locale, and language", () => {
    applyLandingSeo({ locale: "en", canonicalPath: "/about" });

    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toContain("Schedule planner by voice or text");
    expect(metaContent('meta[name="description"]')).toContain(
      "Type or say a plan naturally",
    );
    expect(metaContent('meta[property="og:locale"]')).toBe("en_US");
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ).toBe("https://itjima.app/about");
  });

  it("publishes Korean metadata when Korean is selected", () => {
    applyLandingSeo({ locale: "ko", canonicalPath: "/about" });

    expect(document.documentElement.lang).toBe("ko");
    expect(document.title).toContain("말로 쓰는 일정 관리 앱");
    expect(metaContent('meta[property="og:title"]')).toContain(
      "대충 말해도 일정이 돼요",
    );
    expect(metaContent('meta[property="og:description"]')).toContain(
      "애매한 부분만 물어보는 일정 관리 앱",
    );
    expect(metaContent('meta[property="og:locale"]')).toBe("ko_KR");
    expect(metaContent('meta[property="og:image"]')).toBe(
      "https://itjima.app/og-itjima-schedule-v2.png",
    );
    expect(metaContent('meta[property="og:image:type"]')).toBe("image/png");
    expect(metaContent('meta[property="og:image:width"]')).toBe("1200");
    expect(metaContent('meta[property="og:image:height"]')).toBe("630");
  });

  it("provides alternate-language links", () => {
    applyLandingSeo({ locale: "en", canonicalPath: "/about" });

    expect(
      document.querySelector<HTMLLinkElement>(
        'link[rel="alternate"][hreflang="ko"]',
      )?.href,
    ).toContain("/about?lang=ko");
    expect(
      document.querySelector<HTMLLinkElement>(
        'link[rel="alternate"][hreflang="en"]',
      )?.href,
    ).toContain("/about?lang=en");
  });

  it("describes the English product as a bilingual scheduling app", () => {
    const graph = landingStructuredDataGraph([], "en") as {
      "@graph": Array<Record<string, unknown>>;
    };
    const software = graph["@graph"].find(
      (node) => node["@type"] === "SoftwareApplication",
    );

    expect(software?.applicationSubCategory).toBe("CalendarApplication");
    expect(software?.inLanguage).toEqual(["en-US", "ko-KR"]);
    expect(software?.featureList).toContain(
      "Natural-language schedule capture",
    );
  });

  it("identifies LinkedIn as an official Itjima profile", () => {
    const graph = landingStructuredDataGraph([], "ko") as {
      "@graph": Array<Record<string, unknown>>;
    };
    const organization = graph["@graph"].find(
      (node) => node["@type"] === "Organization",
    );

    expect(organization?.sameAs).toContain(
      "https://www.linkedin.com/company/itjima",
    );
  });
});
