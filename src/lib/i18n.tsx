import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ko" | "en";

export const LANGUAGE_STORAGE_KEY = "itjima_lang";

export function languageFromBrowser(
  languages: readonly string[] | null | undefined,
): Lang {
  const normalized = (languages ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return normalized.some(
    (value) => value === "ko" || value.startsWith("ko-"),
  )
    ? "ko"
    : "en";
}

export function languageFromSearch(search: string): Lang | null {
  const value = new URLSearchParams(search).get("lang")?.toLowerCase();
  return value === "ko" || value === "en" ? value : null;
}

function detectInitial(): Lang {
  if (typeof window === "undefined") return "en";

  const requested = languageFromSearch(window.location.search);
  if (requested) return requested;

  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "ko" || stored === "en") return stored;
  } catch {
    // Browser language is still a safe fallback.
  }

  const languages =
    typeof navigator === "undefined"
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
  return languageFromBrowser(languages);
}

function reflectLanguageInUrl(lang: Lang) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.pathname.startsWith("/about") && !url.searchParams.has("lang")) return;
  url.searchParams.set("lang", lang);
  window.history.replaceState(window.history.state, "", url);
}

type Ctx = {
  lang: Lang;
  setLang: (language: Lang) => void;
  toggle: () => void;
  t: (ko: string, en: string) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectInitial());

  // Reflect on <html lang> for screen readers, search, and browser translation.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  const setLang = useCallback((language: Lang) => {
    setLangState(language);
    reflectLanguageInUrl(language);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Keep the current session language even if storage is unavailable.
    }
  }, []);

  const toggle = useCallback(() => {
    setLang(lang === "ko" ? "en" : "ko");
  }, [lang, setLang]);

  const t = useCallback(
    (ko: string, en: string) => (lang === "en" ? en : ko),
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, toggle, t }),
    [lang, setLang, toggle, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLang must be used within LanguageProvider");
  return context;
}

export function useT() {
  return useLang().t;
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const firstOptionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.setTimeout(() => firstOptionRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t("언어 선택", "Select language")}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="touch-target gap-1 rounded-full glass px-3 text-[11px] font-bold text-ink-soft"
      >
        <span aria-hidden>🌐</span>
        <span>{lang === "ko" ? "한국어" : "English"}</span>
        <span aria-hidden className="text-[8px] opacity-60">
          ▼
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t("언어", "Language")}
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[132px] overflow-hidden rounded-[18px] border border-ink/10 bg-white/96 p-1.5 shadow-float backdrop-blur-2xl"
        >
          {[
            { value: "ko" as const, label: "한국어" },
            { value: "en" as const, label: "English" },
          ].map((option, index) => (
            <li key={option.value}>
              <button
                ref={index === 0 ? firstOptionRef : undefined}
                type="button"
                role="option"
                aria-selected={lang === option.value}
                onClick={() => {
                  setLang(option.value);
                  setOpen(false);
                }}
                className={`flex min-h-11 w-full items-center justify-between rounded-[13px] px-3 py-2.5 text-left text-[13px] font-semibold ${
                  lang === option.value
                    ? "bg-primary/18 text-ink"
                    : "text-ink-soft hover:bg-black/5"
                }`}
              >
                <span>{option.label}</span>
                {lang === option.value && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
