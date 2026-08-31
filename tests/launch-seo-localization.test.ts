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
  it("publishes an English title, description, locale, and homepage canonical", () => {
    applyLandingSeo({ locale: "en", canonicalPath: "/about" });

    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toContain("Natural-language notes, tasks, and schedules");
    expect(metaContent('meta[name="description"]')).toContain(
      "Capture notes, tasks, and schedules in one natural sentence",
    );
    expect(metaContent('meta[property="og:locale"]')).toBe("en_US");
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ).toBe("https://itjima.app/");
  });

  it("publishes Korean metadata when Korean is selected", () => {
    applyLandingSeo({ locale: "ko", canonicalPath: "/" });

    expect(document.documentElement.lang).toBe("ko");
    expect(document.title).toContain("알아서 정리되는 메모·일정 앱");
    expect(metaContent('meta[property="og:title"]')).toContain(
      "살아있는 메모",
    );
    expect(metaContent('meta[property="og:description"]')).toContain(
      "다시 보기 쉽게",
    );
    expect(metaContent('meta[property="og:site_name"]')).toBe("잊지마");
    expect(metaContent('meta[property="og:locale"]')).toBe("ko_KR");
    expect(metaContent('meta[property="og:image"]')).toBe(
      "https://itjima.app/og-itjima-brand-v3.png",
    );
    expect(metaContent('meta[property="og:image:type"]')).toBe("image/png");
    expect(metaContent('meta[property="og:image:width"]')).toBe("1200");
    expect(metaContent('meta[property="og:image:height"]')).toBe("630");
  });

  it("provides homepage alternate-language links", () => {
    applyLandingSeo({ locale: "en", canonicalPath: "/" });

    expect(
      document.querySelector<HTMLLinkElement>(
        'link[rel="alternate"][hreflang="ko"]',
      )?.href,
    ).toBe("https://itjima.app/?lang=ko");
    expect(
      document.querySelector<HTMLLinkElement>(
        'link[rel="alternate"][hreflang="en"]',
      )?.href,
    ).toBe("https://itjima.app/?lang=en");
  });

  it("describes the English product as a bilingual productivity app", () => {
    const graph = landingStructuredDataGraph([], "en") as {
      "@graph": Array<Record<string, unknown>>;
    };
    const software = graph["@graph"].find(
      (node) => node["@type"] === "SoftwareApplication",
    );

    expect(software?.applicationSubCategory).toBe("CalendarApplication");
    expect(software?.inLanguage).toEqual(["en-US", "ko-KR"]);
    expect(software?.featureList).toContain(
      "Natural-language note, task, and schedule capture",
    );
    expect(software?.featureList).toContain("Schedule and task review");
  });

  it("uses 잊지마 as the preferred homepage site name", () => {
    const graph = landingStructuredDataGraph([], "ko") as {
      "@graph": Array<Record<string, unknown>>;
    };
    const website = graph["@graph"].find(
      (node) => node["@type"] === "WebSite",
    );

    expect(website?.name).toBe("잊지마");
    expect(website?.url).toBe("https://itjima.app/");
    expect(website?.alternateName).toContain("Itjima");
    expect(website?.alternateName).toContain("itjima.app");
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
