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
  it("publishes an English AI title, description, and dedicated About canonical", () => {
    applyLandingSeo({ locale: "en", canonicalPath: "/about" });

    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toContain("AI notes, tasks, and schedules");
    expect(metaContent('meta[name="description"]')).toContain(
      "AI note and scheduling app",
    );
    expect(metaContent('meta[property="og:locale"]')).toBe("en_US");
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ).toBe("https://itjima.app/about");
    expect(
      document.querySelector<HTMLLinkElement>(
        'link[rel="alternate"][hreflang="ko"]',
      )?.href,
    ).toBe("https://itjima.app/about?lang=ko");
  });

  it("publishes Korean metadata with 잊지마 and Itjima tied to the AI app", () => {
    applyLandingSeo({ locale: "ko", canonicalPath: "/" });

    expect(document.documentElement.lang).toBe("ko");
    expect(document.title).toContain("잊지마(Itjima)");
    expect(document.title).toContain("자연어 AI 메모·일정 앱");
    expect(metaContent('meta[name="description"]')).toContain(
      "AI 메모·일정 앱",
    );
    expect(metaContent('meta[property="og:title"]')).toContain(
      "잊지마(Itjima)",
    );
    expect(metaContent('meta[property="og:description"]')).toContain(
      "다시 보기 쉽게",
    );
    expect(metaContent('meta[property="og:site_name"]')).toBe("잊지마");
    expect(metaContent('meta[property="og:locale"]')).toBe("ko_KR");
    expect(metaContent('meta[property="og:image"]')).toBe(
      "https://itjima.app/og-itjima-brand-v7.png",
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

  it("describes the product as an AI note-taking application", () => {
    const graph = landingStructuredDataGraph([], "en") as {
      "@graph": Array<Record<string, unknown>>;
    };
    const software = graph["@graph"].find(
      (node) => node["@type"] === "SoftwareApplication",
    );

    expect(software?.applicationSubCategory).toBe("NoteTakingApplication");
    expect(software?.inLanguage).toEqual(["en-US", "ko-KR"]);
    expect(String(software?.description)).toContain("AI productivity web app");
    expect(software?.featureList).toContain(
      "Natural-language note, task, and schedule capture",
    );
    expect(software?.featureList).toContain("Schedule and task review");
  });

  it("uses 잊지마 as the preferred site name and associates common brand queries", () => {
    const graph = landingStructuredDataGraph([], "ko") as {
      "@graph": Array<Record<string, unknown>>;
    };
    const website = graph["@graph"].find(
      (node) => node["@type"] === "WebSite",
    );

    expect(website?.name).toBe("잊지마");
    expect(website?.url).toBe("https://itjima.app/");
    expect(website?.alternateName).toContain("Itjima");
    expect(website?.alternateName).toContain("잊지마 앱");
    expect(website?.alternateName).toContain("Itjima app");
    expect(website?.alternateName).toContain("itjima.app");
  });

  it("identifies official Itjima profiles and the AI memo topic", () => {
    const graph = landingStructuredDataGraph([], "ko") as {
      "@graph": Array<Record<string, unknown>>;
    };
    const organization = graph["@graph"].find(
      (node) => node["@type"] === "Organization",
    );

    expect(organization?.sameAs).toContain(
      "https://www.linkedin.com/company/itjima",
    );
    expect(organization?.knowsAbout).toContain("AI 메모");
  });
});
