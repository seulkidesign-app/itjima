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
  logoAlt: "잊지마(Itjima) 기억 인박스",
  taglineKo: "정리하기 전에, 먼저 잊지 않게.",
  taglineEn: "Remember before you organize.",
  /** Verified external profiles that describe the same product entity. */
  sameAs: [
    "https://itjima.app",
    "https://itjima.app/about",
    "https://github.com/seulkidesign-app/itjima",
    "https://www.instagram.com/itjima.app",
  ] as const,
  instagramUrl: "https://www.instagram.com/itjima.app",
  privacyUrl: "https://itjima.app/about#privacy",
  termsUrl: "https://itjima.app/about#terms",
  foundingDate: "2026",
  softwareVersion: "Beta",
  appVersionLabel: "Beta · 2026.07",
  category: "Memory inbox app",
  aboutIntro: {
    ko: "잊지마(Itjima)는 정리하기 전에 생각을 잊지 않게 해주는 기억 인박스입니다. 떠오르면 던지고, 필요할 때 다시 꺼내세요.",
    en: "Itjima (잊지마) is a memory inbox that keeps thoughts safe before you organize them. Drop it now, resurface when you need it.",
  },
  releaseNotes: {
    version: "Beta",
    date: "2026-07-18",
    title: { ko: "첫 공개 베타", en: "First public beta" },
    highlights: {
      ko: [
        "홈에서 생각을 바로 던지기",
        "일정 · 보관함으로 정리",
        "정리 전, 기억부터",
      ],
      en: [
        "Drop thoughts from Home",
        "Schedule and Archive views",
        "Remember before you organize",
      ],
    },
  },
} as const;

export function brandTitle(page?: string) {
  const base = `${BRAND.displayKo} | 기억 인박스`;
  return page ? `${page} — ${BRAND.displayKo}` : base;
}

export function brandTitleEn(page?: string) {
  const base = `${BRAND.displayEn} | Memory inbox`;
  return page ? `${page} — ${BRAND.displayEn}` : base;
}
