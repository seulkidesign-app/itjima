/** Canonical brand entity — single source of truth for Itjima ↔ 잊지마. */
export const BRAND = {
  name: "Itjima",
  /** Romanized variants Google may encounter in the wild. */
  alternateNames: ["잊지마", "ItJima", "잊지마 앱", "Itjima app"] as const,
  displayKo: "잊지마 (Itjima)",
  displayEn: "Itjima (잊지마)",
  siteUrl: "https://itjima.app",
  landingPath: "/about",
  landingUrl: "https://itjima.app/about",
  logoUrl: "https://itjima.app/favicon.svg",
  logoAlt: "잊지마(Itjima) AI 기억 관리 앱",
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
  category: "AI memory management app",
  aboutIntro: {
    ko: "잊지마(Itjima)는 떠오른 생각을 AI 메모와 일정으로 정리하는 기억 관리 앱입니다. 기억하지 말고, 여기에 맡기세요.",
    en: "Itjima (잊지마) organizes thoughts with AI notes and schedules. Don't memorize — offload here.",
  },
  releaseNotes: {
    version: "Beta",
    date: "2026-07-18",
    title: { ko: "첫 공개 베타", en: "First public beta" },
    highlights: {
      ko: [
        "홈에서 생각을 바로 던지기",
        "일정 · 보관함으로 정리",
        "AI 기억 관리 · 생각 정리",
      ],
      en: [
        "Drop thoughts from Home",
        "Schedule and Archive views",
        "AI memory · thought organization",
      ],
    },
  },
} as const;

export function brandTitle(page?: string) {
  const base = `${BRAND.displayKo} | AI 기억 관리 앱`;
  return page ? `${page} — ${BRAND.displayKo}` : base;
}

export function brandTitleEn(page?: string) {
  const base = `${BRAND.displayEn} | AI memory app`;
  return page ? `${page} — ${BRAND.displayEn}` : base;
}
