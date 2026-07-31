import { BRAND } from "@/lib/brand";
import type { Lang } from "@/lib/i18n";

/** Public site URL — used for canonical, Open Graph, and sitemap. */
export const SITE_URL = BRAND.siteUrl;

const SEO_BY_LOCALE = {
  ko: {
    landingTitle: "잊지마 Itjima | 말하듯 남기는 일정 캡처",
    landingDescription:
      "말하듯 일정을 남기면 확실한 정보는 채우고, 애매한 날짜와 시간만 확인해 일정으로 만듭니다.",
    ogTitle: "잊지마 Itjima | 자연어 일정 캡처",
    ogDescription:
      "자연어로 일정을 남기고, 위험한 추측이 필요한 날짜와 시간만 확인하세요.",
    appDescription:
      "잊지마 Itjima는 자연어 입력을 일정과 할 일로 바꾸는 한국어·영어 웹앱입니다.",
    keywords:
      "잊지마, Itjima, 자연어 일정, 일정 캡처, 음성 일정, 할 일, 캘린더, 리마인더",
    locale: "ko_KR",
    language: "ko-KR",
    currency: "KRW",
  },
  en: {
    landingTitle: "Itjima | Natural-language schedule capture",
    landingDescription:
      "Say a plan naturally. Itjima fills what is clear, asks only about ambiguous date and time details, and turns it into a usable schedule.",
    ogTitle: "Itjima | Natural-language scheduling",
    ogDescription:
      "Capture plans in your own words, confirm only uncertain date and time details, and add a usable schedule in one tap.",
    appDescription:
      "Itjima is an English and Korean web app that turns natural-language input into schedules and tasks.",
    keywords:
      "Itjima, natural language scheduling, schedule capture, voice schedule, task capture, calendar, reminder",
    locale: "en_US",
    language: "en-US",
    currency: "USD",
  },
} as const;

/** Legacy export retained for callers that expect the Korean defaults. */
export const SEO = SEO_BY_LOCALE.ko;

const ORG_ID = `${SITE_URL}/#organization`;
const BRAND_ID = `${SITE_URL}/#brand`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#software`;
const ABOUT_PAGE_ID = `${SITE_URL}/about#webpage`;
const BREADCRUMB_ID = `${SITE_URL}/about#breadcrumb`;

function localizedSeo(locale: Lang) {
  return SEO_BY_LOCALE[locale];
}

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
  let element = document.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  if (typeof document === "undefined") return;
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let element = document.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    if (hreflang) element.hreflang = hreflang;
    document.head.appendChild(element);
  }
  element.href = href;
}

export function injectJsonLd(id: string, data: object) {
  if (typeof document === "undefined") return;
  let element = document.getElementById(id) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

export function removeJsonLd(id: string) {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.remove();
}

export type LandingSeoOptions = {
  canonicalPath?: string;
  title?: string;
  description?: string;
  locale?: Lang;
};

export function applyLandingSeo(options: LandingSeoOptions = {}) {
  if (typeof document === "undefined") return;
  const locale = options.locale ?? "ko";
  const seo = localizedSeo(locale);
  const canonicalPath = options.canonicalPath ?? "/about";
  const title = options.title ?? seo.landingTitle;
  const description = options.description ?? seo.landingDescription;
  const canonical = `${SITE_URL}${canonicalPath}`;

  document.title = title;
  document.documentElement.lang = locale;

  upsertMeta("description", description);
  upsertMeta("keywords", seo.keywords);
  upsertMeta("author", BRAND.displayEn);
  upsertMeta("application-name", BRAND.displayEn);
  upsertMeta("apple-mobile-web-app-title", BRAND.name);
  upsertLink("canonical", canonical);
  upsertLink("alternate", `${SITE_URL}/about?lang=ko`, "ko");
  upsertLink("alternate", `${SITE_URL}/about?lang=en`, "en");
  upsertLink("alternate", `${SITE_URL}/about`, "x-default");

  upsertMeta("og:title", title, "property");
  upsertMeta("og:description", description, "property");
  upsertMeta("og:type", "website", "property");
  upsertMeta("og:url", canonical, "property");
  upsertMeta("og:locale", seo.locale, "property");
  upsertMeta(
    "og:locale:alternate",
    locale === "en" ? "ko_KR" : "en_US",
    "property",
  );
  upsertMeta("og:site_name", BRAND.displayEn, "property");
  upsertMeta("og:image", BRAND.ogImageUrl, "property");
  upsertMeta("og:image:alt", BRAND.logoAlt, "property");

  upsertMeta("twitter:card", "summary_large_image");
  upsertMeta("twitter:title", title);
  upsertMeta("twitter:description", description);
  upsertMeta("twitter:image", BRAND.ogImageUrl);
  upsertMeta("twitter:image:alt", BRAND.logoAlt);
}

export function landingOrganizationLd(locale: Lang = "ko") {
  const seo = localizedSeo(locale);
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
      "natural-language scheduling",
      "task capture",
      "reminders",
      "productivity software",
      "자연어 일정",
      "잊지마",
      "Itjima",
    ],
    makesOffer: {
      "@type": "Offer",
      itemOffered: { "@id": APP_ID },
      price: "0",
      priceCurrency: seo.currency,
    },
  };
}

export function landingWebSiteLd(locale: Lang = "ko") {
  const seo = localizedSeo(locale);
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: BRAND.name,
    alternateName: [...BRAND.alternateNames],
    url: SITE_URL,
    inLanguage: seo.language,
    publisher: { "@id": ORG_ID },
    about: { "@id": APP_ID },
  };
}

export function landingWebPageLd(locale: Lang = "ko") {
  const seo = localizedSeo(locale);
  return {
    "@type": "WebPage",
    "@id": ABOUT_PAGE_ID,
    url: `${SITE_URL}/about`,
    name: seo.landingTitle,
    description: seo.landingDescription,
    inLanguage: seo.language,
    isPartOf: { "@id": WEBSITE_ID },
    about: [{ "@id": ORG_ID }, { "@id": APP_ID }],
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: BRAND.ogImageUrl,
      name: BRAND.logoAlt,
    },
    breadcrumb: { "@id": BREADCRUMB_ID },
  };
}

export function landingBreadcrumbLd(locale: Lang = "ko") {
  const isEnglish = locale === "en";
  return {
    "@type": "BreadcrumbList",
    "@id": BREADCRUMB_ID,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: BRAND.displayEn,
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: isEnglish ? "About" : "소개",
        item: `${SITE_URL}/about`,
      },
    ],
  };
}

export function landingSoftwareApplicationLd(locale: Lang = "ko") {
  const seo = localizedSeo(locale);
  const isEnglish = locale === "en";
  return {
    "@type": "SoftwareApplication",
    "@id": APP_ID,
    name: BRAND.name,
    alternateName: [...BRAND.alternateNames],
    applicationCategory: "ProductivityApplication",
    applicationSubCategory: "CalendarApplication",
    operatingSystem: "Web, iOS PWA, Android PWA",
    url: SITE_URL,
    downloadUrl: SITE_URL,
    softwareVersion: BRAND.softwareVersion,
    inLanguage: ["en-US", "ko-KR"],
    description: seo.appDescription,
    brand: { "@id": BRAND_ID },
    creator: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": WEBSITE_ID },
    featureList: isEnglish
      ? [
          "Natural-language schedule capture",
          "Voice capture",
          "Ambiguity confirmation",
          "Cross-device sync",
          "Push reminders",
          "Data export and account deletion",
        ]
      : [
          "자연어 일정 캡처",
          "음성 입력",
          "애매한 날짜와 시간 확인",
          "기기 간 동기화",
          "푸시 알림",
          "데이터 내려받기와 계정 삭제",
        ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: seo.currency,
    },
  };
}

export function landingFaqLd(
  items: { question: string; answer: string }[],
) {
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

/** Combined @graph — entity-first markup for search and assistant surfaces. */
export function landingStructuredDataGraph(
  faqItems: { question: string; answer: string }[],
  locale: Lang = "ko",
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      brandEntity(),
      landingOrganizationLd(locale),
      landingWebSiteLd(locale),
      landingWebPageLd(locale),
      landingBreadcrumbLd(locale),
      landingSoftwareApplicationLd(locale),
      landingFaqLd(faqItems),
    ],
  };
}
