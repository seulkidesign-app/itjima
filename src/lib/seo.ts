/** Public site URL — used for canonical, Open Graph, and sitemap. */
export const SITE_URL = "https://itjima.app";

export const SEO = {
  siteName: "Itjima",
  alternateName: "잊지마",
  landingTitle: "잊지마 (Itjima) | AI 기억 관리 앱",
  landingDescription:
    "잊지마(Itjima)는 AI 메모와 AI 일정으로 생각을 정리하는 기억 관리·생각 정리 앱입니다. 떠오른 생각을 던지고, 필요할 때 다시 찾으세요.",
  ogTitle: "잊지마 (Itjima)",
  ogDescription:
    "AI 메모·AI 일정·기억 관리 — 잊지마(Itjima)에 생각을 맡기고, 필요할 때 다시 꺼내보세요.",
  appDescription:
    "잊지마(Itjima)는 떠오른 생각을 AI 메모로 남기고, AI 일정과 보관함으로 정리하는 기억 관리 웹앱입니다. Brain dump와 Mental Inbox 방식의 생각 정리 앱.",
  keywords:
    "잊지마, Itjima, 잊지마 앱, 잊지마 메모, 잊지마 일정, AI 메모, AI 일정, 기억 관리 앱, 생각 정리 앱, Brain Dump, Mental Inbox",
} as const;

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#software`;
const ABOUT_PAGE_ID = `${SITE_URL}/about#webpage`;
const BREADCRUMB_ID = `${SITE_URL}/about#breadcrumb`;

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
  const canonicalPath = options.canonicalPath ?? "/about";
  const title = options.title ?? SEO.landingTitle;
  const description = options.description ?? SEO.landingDescription;
  const canonical = `${SITE_URL}${canonicalPath}`;

  document.title = title;
  document.documentElement.lang = "ko";

  upsertMeta("description", description);
  upsertMeta("keywords", SEO.keywords);
  upsertMeta("application-name", `${SEO.alternateName} (${SEO.siteName})`);
  upsertMeta("apple-mobile-web-app-title", SEO.alternateName);
  upsertLink("canonical", canonical);

  upsertMeta("og:title", SEO.ogTitle, "property");
  upsertMeta("og:description", SEO.ogDescription, "property");
  upsertMeta("og:type", "website", "property");
  upsertMeta("og:url", canonical, "property");
  upsertMeta("og:locale", "ko_KR", "property");
  upsertMeta("og:site_name", `${SEO.alternateName} (${SEO.siteName})`, "property");
  upsertMeta("og:image", `${SITE_URL}/favicon.svg`, "property");
  upsertMeta("og:image:alt", "잊지마(Itjima) AI 기억 관리 앱", "property");

  upsertMeta("twitter:card", "summary");
  upsertMeta("twitter:title", SEO.ogTitle);
  upsertMeta("twitter:description", SEO.ogDescription);
  upsertMeta("twitter:image", `${SITE_URL}/favicon.svg`);
  upsertMeta("twitter:image:alt", "잊지마(Itjima) AI 기억 관리 앱");
}

export function landingOrganizationLd() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SEO.siteName,
    alternateName: SEO.alternateName,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/favicon.svg`,
      caption: "잊지마(Itjima) AI 기억 관리 앱",
    },
  };
}

export function landingWebSiteLd() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SEO.siteName,
    alternateName: SEO.alternateName,
    url: SITE_URL,
    inLanguage: "ko-KR",
    publisher: { "@id": ORG_ID },
  };
}

export function landingWebPageLd() {
  return {
    "@type": "WebPage",
    "@id": ABOUT_PAGE_ID,
    url: `${SITE_URL}/about`,
    name: SEO.landingTitle,
    description: SEO.landingDescription,
    inLanguage: "ko-KR",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": APP_ID },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: `${SITE_URL}/favicon.svg`,
      caption: "잊지마(Itjima) AI 기억 관리 앱",
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
        name: "잊지마 (Itjima)",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "소개",
        item: `${SITE_URL}/about`,
      },
    ],
  };
}

export function landingSoftwareApplicationLd() {
  return {
    "@type": "SoftwareApplication",
    "@id": APP_ID,
    name: SEO.siteName,
    alternateName: SEO.alternateName,
    applicationCategory: "ProductivityApplication",
    applicationSubCategory: "NoteTakingApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    downloadUrl: `${SITE_URL}/`,
    inLanguage: "ko-KR",
    description: SEO.appDescription,
    featureList: [
      "AI 메모",
      "AI 일정",
      "기억 관리",
      "생각 정리",
      "Brain dump",
      "Mental inbox",
    ],
    publisher: { "@id": ORG_ID },
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
    "@id": `${SITE_URL}/about#faq`,
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

/** Combined @graph for rich-result eligibility on the landing page. */
export function landingStructuredDataGraph(
  faqItems: { question: string; answer: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      landingOrganizationLd(),
      landingWebSiteLd(),
      landingWebPageLd(),
      landingBreadcrumbLd(),
      landingSoftwareApplicationLd(),
      landingFaqLd(faqItems),
    ],
  };
}
