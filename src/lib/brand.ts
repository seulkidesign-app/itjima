/** Canonical brand entity — single source of truth for Itjima ↔ 잊지마. */
export const BRAND = {
  name: "Itjima",
  /** Romanized variants Google may encounter in the wild. */
  alternateNames: ["잊지마", "ItJima", "잊지마 앱", "Itjima app"] as const,
  displayKo: "잊지마 (Itjima)",
  displayEn: "Itjima (잊지마)",
  siteUrl: "https://itjima.app",
  landingPath: "/",
  landingUrl: "https://itjima.app/",
  logoUrl: "https://itjima.app/favicon.svg",
  ogImageUrl: "https://itjima.app/og-card.svg",
  logoAlt: "잊지마(Itjima) 자연어 일정 캡처 도구",
  taglineKo: "말하듯 남기면 일정이 돼요.",
  taglineEn: "Say it naturally. Turn it into a schedule.",
  /** Verified external profiles that describe the same product entity. */
  sameAs: [
    "https://itjima.app",
    "https://itjima.app/about",
    "https://github.com/seulkidesign-app/itjima",
    "https://www.instagram.com/itjima.app",
  ] as const,
  instagramUrl: "https://www.instagram.com/itjima.app",
  privacyUrl: "https://itjima.app/privacy.html",
  termsUrl: "https://itjima.app/terms.html",
  foundingDate: "2026",
  softwareVersion: "Beta",
  appVersionLabel: "Beta · 2026.07",
  category: "Natural-language schedule capture app",
  aboutIntro: {
    ko: "잊지마(Itjima)는 자연어로 말하듯 남기면 확실한 일정 정보는 채우고, 애매한 부분만 확인하는 일정 캡처 도구입니다.",
    en: "Itjima (잊지마) turns rough natural-language input into usable schedules and asks only about details that are still ambiguous.",
  },
  releaseNotes: {
    version: "Beta",
    date: "2026-07-31",
    title: { ko: "자연어 일정 캡처 베타", en: "Natural-language schedule beta" },
    highlights: {
      ko: [
        "말하듯 일정과 할 일 남기기",
        "애매한 날짜와 시간만 확인",
        "데이터 내려받기와 계정 삭제",
      ],
      en: [
        "Capture schedules and tasks naturally",
        "Confirm only ambiguous date and time details",
        "Download data and delete your account",
      ],
    },
  },
} as const;

export function brandTitle(page?: string) {
  const base = `${BRAND.displayKo} | 자연어 일정 캡처`;
  return page ? `${page} — ${BRAND.displayKo}` : base;
}

export function brandTitleEn(page?: string) {
  const base = `${BRAND.displayEn} | Natural-language schedule capture`;
  return page ? `${page} — ${BRAND.displayEn}` : base;
}
