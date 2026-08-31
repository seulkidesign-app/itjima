import { BRAND } from "@/lib/brand";
import type { Lang } from "@/lib/i18n";

/** Public site URL — used for canonical, Open Graph, and sitemap. */
export const SITE_URL = BRAND.siteUrl;

const PRIMARY_SITE_NAME = "잊지마";
const EN_SITE_NAME = "Itjima";

const SEO_BY_LOCALE = {
  ko: {
    landingTitle: "잊지마 | 자연어로 기록하면 알아서 정리되는 메모·일정 앱",
    landingDescription:
      "메모·할 일·일정을 구분하지 말고 한 문장으로 남기세요. 잊지마가 날짜와 행동을 읽어 자동으로 구조화하고, 필요한 기록을 다시 보기 쉽게 정리해주는 자연어 기록 앱입니다.",
    ogTitle: "생각나는 대로 남기면, 알아서 정리되는 살아있는 메모 | 잊지마",
    ogDescription:
      "자연어로 남긴 메모·할 일·일정을 날짜와 행동에 맞게 구조화해 다시 보기 쉽게 정리해주는 기록 도구.",
    appDescription:
      "잊지마는 자연어로 남긴 메모·할 일·일정에서 날짜와 행동을 읽어 구조화하고 다시 확인하기 쉽게 정리하는 기록 관리 웹앱입니다.",
    keywords:
      "잊지마, 잊지마 앱, Itjima, 자연어 메모, 자연어 기록, 메모 앱, 일정 관리, 일정 관리 앱, 할 일 관리, 캘린더, 리마인더",
    locale: "ko_KR",
    language: "ko-KR",
    currency: "KRW",
  },
  en: {
    landingTitle: "Itjima | Natural-language notes, tasks, and schedules",
    landingDescription:
      "Capture notes, tasks, and schedules in one natural sentence. Itjima reads dates and actions, structures what you wrote, and keeps it easy to revisit.",
    ogTitle: "A living inbox for thoughts before they're organized | Itjima",
    ogDescription:
      "Capture naturally and let Itjima structure notes, tasks, and schedules so they're easy to revisit.",
    appDescription:
      "Itjima is a bilingual productivity web app that structures natural-language notes, tasks, and schedules and keeps them easy to review.",
    keywords:
      "Itjima, natural language notes, task capture, schedule capture, note organizer, calendar, reminders, productivity app",
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
const HOME_PAGE_ID = `${SITE_URL}/#webpage`;
const BREADCRUMB_ID = `${SITE_URL}/#breadcrumb`;

function localizedSeo(locale: Lang) {
  return SEO_BY_LOCALE[locale];
}

function siteName(locale: Lang) {
  return locale === "en" ? EN_SITE_NAME : PRIMARY_SITE_NAME;
}

function brandAlternateNames() {
  return Array.from(
    new Set([
      BRAND.name,
      ...BRAND.alternateNames,
    ].filter((name) => name !== PRIMARY_SITE_NAME)),
  );
}

function normalizeCanonicalPath(path?: string) {
  if (!path || path === "/about") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function brandEntity() {
  return {
    "@type": "Brand" as const,
    "@id": BRAND_ID,
    name: PRIMARY_SITE_NAME,
    alternateName: brandAlternateNames(),
    url: `${SITE_URL}/`,
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
  ogTitle?: string;
  ogDescription?: string;
  locale?: Lang;
};

export function applyLandingSeo(options: LandingSeoOptions = {}) {
  if (typeof document === "undefined") return;
  const locale = options.locale ?? "ko";
  const seo = localizedSeo(locale);
  const canonicalPath = normalizeCanonicalPath(options.canonicalPath);
  const title = options.title ?? seo.landingTitle;
  const description = options.description ?? seo.landingDescription;
  const ogTitle = options.ogTitle ?? seo.ogTitle;
  const ogDescription = options.ogDescription ?? seo.ogDescription;
  const canonical = `${SITE_URL}${canonicalPath}`;
  const localeBase = canonicalPath === "/" ? `${SITE_URL}/` : canonical;

  document.title = title;
  document.documentElement.lang = locale;

  upsertMeta("description", description);
  upsertMeta("keywords", seo.keywords);
  upsertMeta("author", BRAND.displayEn);
  upsertMeta("application-name", siteName(locale));
  upsertMeta("apple-mobile-web-app-title", PRIMARY_SITE_NAME);
  upsertLink("canonical", canonical);
  upsertLink("alternate", `${localeBase}?lang=ko`, "ko");
  upsertLink("alternate", `${localeBase}?lang=en`, "en");
  upsertLink("alternate", localeBase, "x-default");

  upsertMeta("og:title", ogTitle, "property");
  upsertMeta("og:description", ogDescription, "property");
  upsertMeta("og:type", "website", "property");
  upsertMeta("og:url", canonical, "property");
  upsertMeta("og:locale", seo.locale, "property");
  upsertMeta(
    "og:locale:alternate",
    locale === "en" ? "ko_KR" : "en_US",
    "property",
  );
  upsertMeta("og:site_name", siteName(locale), "property");
  upsertMeta("og:image", BRAND.ogImageUrl, "property");
  upsertMeta("og:image:secure_url", BRAND.ogImageUrl, "property");
  upsertMeta("og:image:type", "image/png", "property");
  upsertMeta("og:image:width", "1200", "property");
  upsertMeta("og:image:height", "630", "property");
  upsertMeta("og:image:alt", BRAND.ogImageAlt, "property");

  upsertMeta("twitter:card", "summary_large_image");
  upsertMeta("twitter:title", ogTitle);
  upsertMeta("twitter:description", ogDescription);
  upsertMeta("twitter:image", BRAND.ogImageUrl);
  upsertMeta("twitter:image:alt", BRAND.ogImageAlt);
}

export function landingOrganizationLd(locale: Lang = "ko") {
  const seo = localizedSeo(locale);
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: PRIMARY_SITE_NAME,
    alternateName: brandAlternateNames(),
    url: `${SITE_URL}/`,
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
      "natural-language note capture",
      "natural-language scheduling",
      "automatic record organization",
      "task capture",
      "reminders",
      "productivity software",
      "자연어 기록",
      "메모 정리",
      "일정 관리",
      "할 일 관리",
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
    name: PRIMARY_SITE_NAME,
    alternateName: [EN_SITE_NAME, "ItJima", "itjima.app"],
    url: `${SITE_URL}/`,
    inLanguage: seo.language,
    publisher: { "@id": ORG_ID },
    about: { "@id": APP_ID },
  };
}

export function landingWebPageLd(locale: Lang = "ko") {
  const seo = localizedSeo(locale);
  return {
    "@type": "WebPage",
    "@id": HOME_PAGE_ID,
    url: `${SITE_URL}/`,
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
  return {
    "@type": "BreadcrumbList",
    "@id": BREADCRUMB_ID,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: siteName(locale),
        item: `${SITE_URL}/`,
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
    name: PRIMARY_SITE_NAME,
    alternateName: brandAlternateNames(),
    applicationCategory: "ProductivityApplication",
    applicationSubCategory: "CalendarApplication",
    operatingSystem: "Web, iOS PWA, Android PWA",
    url: `${SITE_URL}/`,
    downloadUrl: `${SITE_URL}/`,
    softwareVersion: BRAND.softwareVersion,
    inLanguage: ["en-US", "ko-KR"],
    description: seo.appDescription,
    brand: { "@id": BRAND_ID },
    creator: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": WEBSITE_ID },
    featureList: isEnglish
      ? [
          "Natural-language note, task, and schedule capture",
          "Automatic structure from dates and actions",
          "Schedule and task review",
          "Voice capture",
          "Ambiguity confirmation",
          "Cross-device sync",
          "Push reminders",
          "Data export and account deletion",
        ]
      : [
          "자연어·음성으로 메모·할 일·일정 기록",
          "날짜와 행동을 읽어 자동 구조화",
          "일정과 할 일 다시 확인하기",
          "애매한 일정 정보만 확인",
          "일정과 할 일 관리",
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

export function landingFaqLd(items: { question: string; answer: string }[]) {
  return {
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
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
