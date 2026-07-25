import { BRAND } from "@/lib/brand";

/** Public site URL — used for canonical, Open Graph, and sitemap. */
export const SITE_URL = BRAND.siteUrl;

export const SEO = {
  siteName: BRAND.name,
  alternateNames: BRAND.alternateNames,
  landingTitle: `${BRAND.displayKo} | AI 기억 관리 앱`,
  landingDescription:
    "잊지마(Itjima)는 AI 메모와 AI 일정으로 생각을 정리하는 기억 관리·생각 정리 앱입니다. Itjima와 잊지마는 같은 소프트웨어입니다.",
  ogTitle: BRAND.displayKo,
  ogDescription:
    "AI 메모·AI 일정·기억 관리 — 잊지마(Itjima)에 생각을 맡기고, 필요할 때 다시 꺼내보세요.",
  appDescription:
    "잊지마(Itjima)는 떠오른 생각을 AI 메모로 남기고, AI 일정과 보관함으로 정리하는 기억 관리 웹앱입니다. Itjima와 잊지마는 동일한 제품입니다.",
  keywords:
    "잊지마, Itjima, ItJima, 잊지마 앱, 잊지마 메모, 잊지마 일정, AI 메모, AI 일정, 기억 관리 앱, 생각 정리 앱",
} as const;

const ORG_ID = `${SITE_URL}/#organization`;
const BRAND_ID = `${SITE_URL}/#brand`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#software`;
const ABOUT_PAGE_ID = `${BRAND.landingUrl}#webpage`;
const BREADCRUMB_ID = `${BRAND.landingUrl}#breadcrumb`;

function brandEntity() {
  return {
    "@type": "Brand" as const,
    "@id": BRAND_ID,
    name: BRAND.name,
    alternateName: [...BRAND.alternateNames],
    logo: {
      "@type": "ImageObject" as const,
      url: BRAND.logoUrl,
      name: BRAND.logoAlt,
    },
  };
}

function upsertMeta(
  key: string,
  content: string,
  attr: "name" | "property" = "name",
) {
  if (typeof document === "undefined") return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  if (typeof document === "undefined") return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function injectJsonLd(id: string, data: object) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function removeJsonLd(id: string) {
  document.getElementById(id)?.remove();
}

export type LandingSeoOptions = {
  canonicalPath?: string;
  title?: string;
  description?: string;
};

export function applyLandingSeo(options: LandingSeoOptions = {}) {
  const canonicalPath = options.canonicalPath ?? BRAND.landingPath;
  const title = options.title ?? SEO.landingTitle;
  const description = options.description ?? SEO.landingDescription;
  const canonical = `${SITE_URL}${canonicalPath}`;

  document.title = title;
  document.documentElement.lang = "ko";

  upsertMeta("description", description);
  upsertMeta("keywords", SEO.keywords);
  upsertMeta("author", BRAND.displayKo);
  upsertMeta("application-name", BRAND.displayKo);
  upsertMeta("apple-mobile-web-app-title", "잊지마");
  upsertLink("canonical", canonical);

  upsertMeta("og:title", SEO.ogTitle, "property");
  upsertMeta("og:description", SEO.ogDescription, "property");
  upsertMeta("og:type", "website", "property");
  upsertMeta("og:url", canonical, "property");
  upsertMeta("og:locale", "ko_KR", "property");
  upsertMeta("og:site_name", BRAND.displayKo, "property");
  upsertMeta("og:image", BRAND.logoUrl, "property");
  upsertMeta("og:image:alt", BRAND.logoAlt, "property");

  upsertMeta("twitter:card", "summary");
  upsertMeta("twitter:title", SEO.ogTitle);
  upsertMeta("twitter:description", SEO.ogDescription);
  upsertMeta("twitter:image", BRAND.logoUrl);
  upsertMeta("twitter:image:alt", BRAND.logoAlt);
}

export function landingOrganizationLd() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: BRAND.name,
    alternateName: [...BRAND.alternateNames],
    url: SITE_URL,
    foundingDate: BRAND.foundingDate,
    sameAs: [...BRAND.sameAs],
    brand: { "@id": BRAND_ID },
    logo: {
      "@type": "ImageObject",
      url: BRAND.logoUrl,
      name: BRAND.logoAlt,
      caption: BRAND.logoAlt,
    },
    knowsAbout: [
      "AI memory management",
      "AI notes",
      "AI scheduling",
      "productivity software",
      "잊지마",
      "Itjima",
    ],
    makesOffer: {
      "@type": "Offer",
      itemOffered: { "@id": APP_ID },
      price: "0",
      priceCurrency: "KRW",
    },
  };
}

export function landingWebSiteLd() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: BRAND.name,
    alternateName: [...BRAND.alternateNames],
    url: SITE_URL,
    inLanguage: "ko-KR",
    publisher: { "@id": ORG_ID },
    about: { "@id": APP_ID },
  };
}

export function landingWebPageLd() {
  return {
    "@type": "WebPage",
    "@id": ABOUT_PAGE_ID,
    url: BRAND.landingUrl,
    name: SEO.landingTitle,
    description: SEO.landingDescription,
    inLanguage: "ko-KR",
    isPartOf: { "@id": WEBSITE_ID },
    about: [{ "@id": ORG_ID }, { "@id": APP_ID }],
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: BRAND.logoUrl,
      name: BRAND.logoAlt,
    },
    breadcrumb: { "@id": BREADCRUMB_ID },
  };
}

export function landingBreadcrumbLd() {
  return {
    "@type": "BreadcrumbList",
    "@id": BREADCRUMB_ID,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: BRAND.displayKo,
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "소개",
        item: BRAND.landingUrl,
      },
    ],
  };
}

export function landingSoftwareApplicationLd() {
  return {
    "@type": "SoftwareApplication",
    "@id": APP_ID,
    name: BRAND.name,
    alternateName: [...BRAND.alternateNames],
    applicationCategory: "ProductivityApplication",
    applicationSubCategory: "NoteTakingApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    downloadUrl: `${SITE_URL}/`,
    softwareVersion: BRAND.softwareVersion,
    inLanguage: "ko-KR",
    description: SEO.appDescription,
    brand: { "@id": BRAND_ID },
    creator: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": WEBSITE_ID },
    featureList: [
      "AI 메모",
      "AI 일정",
      "기억 관리",
      "생각 정리",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "KRW",
    },
  };
}

export function landingFaqLd(items: { question: string; answer: string }[]) {
  return {
    "@type": "FAQPage",
    "@id": `${BRAND.landingUrl}#faq`,
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
}

/** Combined @graph — entity-first markup for Google Knowledge Graph signals. */
export function landingStructuredDataGraph(
  faqItems: { question: string; answer: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      brandEntity(),
      landingOrganizationLd(),
      landingWebSiteLd(),
      landingWebPageLd(),
      landingBreadcrumbLd(),
      landingSoftwareApplicationLd(),
      landingFaqLd(faqItems),
    ],
  };
}
