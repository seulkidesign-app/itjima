import { Link, useRouterState } from "@tanstack/react-router";
import { User } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { useT } from "@/lib/i18n";
import { SPRING_TAB } from "@/lib/motion";
import { useUserId } from "@/lib/store";
import { tap } from "@/lib/haptics";
import { SettingsSheet } from "./SettingsSheet";

export function TopNav() {
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const userId = useUserId();
  const tabs = [
    { to: "/", label: t("던지기", "Throw") },
    { to: "/schedule", label: t("오늘", "Today") },
    { to: "/archive", label: t("생각 보관함", "Vault") },
  ] as const;

  const [scrolled, setScrolled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const el = document.getElementById("phone-scroll");
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 4);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div
        className={`shrink-0 z-40 bg-white/95 backdrop-blur-md transition-shadow ${
          scrolled ? "border-b border-ink/10 shadow-card" : ""
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between px-5 pt-2 pb-1">
          <Link
            to="/"
            className="font-display text-[20px] uppercase leading-none tracking-wide text-ink"
          >
            ITJIMA
            <span className="ml-1 inline-block h-1.5 w-1.5 -translate-y-1 rounded-full bg-primary align-middle" />
          </Link>
          <button
            type="button"
            aria-label={t("설정", "Settings")}
            onClick={() => {
              tap();
              setSettingsOpen(true);
            }}
            className="touch-target flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-2.5 py-1.5 text-ink-soft shadow-[0_1px_3px_oklch(0_0_0/0.04)]"
          >
            <User size={16} strokeWidth={2.25} />
            <span className="text-[11px] font-semibold">
              {userId ? t("계정", "Account") : t("로그인", "Sign in")}
            </span>
          </button>
        </div>
        <LayoutGroup>
          <nav className="flex items-stretch px-5">
            {tabs.map(({ to, label }) => {
              const active = path === to;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={tap}
                  className={`relative flex flex-1 items-center justify-center pt-1 pb-3 text-[14px] font-semibold tracking-[-0.01em] transition-colors duration-200 ${
                    active ? "text-ink" : "text-ink-soft"
                  }`}
                >
                  {label}
                  {active && (
                    <motion.span
                      layoutId="topnav-tab-underline"
                      className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-ink"
                      transition={SPRING_TAB}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
      </div>
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
