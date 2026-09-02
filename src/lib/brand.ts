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
  logoUrl: "https://itjima.app/icons/itjima-512-v7.png",
  ogImageUrl: "https://itjima.app/og-itjima-brand-v7.png",
  ogImageAlt: "노란 배경 위의 잊지마 >ij< 심볼과 itjima 워드마크",
  logoAlt: "잊지마(itjima) >ij< 브랜드 아이콘",
  taglineKo: "대충 말해도 일정이 돼요.",
  taglineEn: "Say it roughly. Turn it into a schedule.",
  /** Verified external profiles that describe the same product entity. */
  sameAs: [
    "https://itjima.app",
    "https://itjima.app/about",
    "https://github.com/seulkidesign-app/itjima",
    "https://www.instagram.com/itjima.app",
    "https://www.linkedin.com/company/itjima",
  ] as const,
  instagramUrl: "https://www.instagram.com/itjima.app",
  linkedinUrl: "https://www.linkedin.com/company/itjima",
  privacyUrl: "https://itjima.app/privacy.html",
  termsUrl: "https://itjima.app/terms.html",
  foundingDate: "2026",
  softwareVersion: "Beta",
  appVersionLabel: "Beta · 2026.07",
  category: "Natural-language schedule capture app",
  aboutIntro: {
    ko: "잊지마(Itjima)는 일정과 할 일을 말하거나 적으면 날짜와 시간을 정리하고, 애매한 부분만 확인하는 일정 관리 앱입니다.",
    en: "Itjima (잊지마) turns rough natural-language input into usable schedules and asks only about details that are still ambiguous.",
  },
  releaseNotes: {
    version: "Beta",
    date: "2026-07-31",
    title: {
      ko: "자연어 일정 캡처 베타",
      en: "Natural-language schedule beta",
    },
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
  const base = `${BRAND.displayKo} | 일정 관리 앱`;
  return page ? `${page} — ${BRAND.displayKo}` : base;
}

export function brandTitleEn(page?: string) {
  const base = `${BRAND.displayEn} | Natural-language schedule capture`;
  return page ? `${page} — ${BRAND.displayEn}` : base;
}
