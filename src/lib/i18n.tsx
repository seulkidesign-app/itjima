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

const STORAGE_KEY = "itjima_lang";

function detectInitial(): Lang {
  if (typeof window === "undefined") return "ko";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en") return "en";
  } catch {
    // ignore
  }
  return "ko";
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (ko: string, en: string) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");

  // Hydrate from storage / browser on mount (client only)
  useEffect(() => {
    setLangState(detectInitial());
  }, []);

  // Reflect on <html lang>
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
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
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

export function useT() {
  return useLang().t;
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[120px] overflow-hidden rounded-[24px] bg-white shadow-card"
        >
          {[
            { v: "ko" as const, label: "한국어" },
            { v: "en" as const, label: "English" },
          ].map((opt) => (
            <li key={opt.v}>
              <button
                type="button"
                role="option"
                aria-selected={lang === opt.v}
                onClick={() => {
                  setLang(opt.v);
                  setOpen(false);
                }}
                className={`flex min-h-11 w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-semibold ${
                  lang === opt.v
                    ? "bg-primary/15 text-ink"
                    : "text-ink-soft hover:bg-black/5"
                }`}
              >
                <span>{opt.label}</span>
                {lang === opt.v && <span className="text-primary">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
