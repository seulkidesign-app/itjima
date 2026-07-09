import { Link, useRouterState } from "@tanstack/react-router";
import { Info, MessageSquarePlus, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { useT, LanguageToggle } from "@/lib/i18n";
import { SPRING_TAB } from "@/lib/motion";
import { useUserId } from "@/lib/store";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { tap } from "@/lib/haptics";
import { AboutSheet } from "./AboutSheet";
import { FeedbackSheet } from "./FeedbackSheet";

export function TopNav() {
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const userId = useUserId();
  const isAdmin = useIsAdmin();
  const tabs = [
    { to: "/", label: t("생각", "Thoughts") },
    { to: "/schedule", label: t("그때", "When") },
    { to: "/archive", label: t("기억함", "Kept") },
  ] as const;

  // Subtle scroll shadow once scrolled past 4px
  const [scrolled, setScrolled] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  useEffect(() => {
    const el = document.getElementById("phone-scroll");
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 4);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`shrink-0 z-40 md:hidden bg-white/95 backdrop-blur-md transition-shadow ${
        scrolled ? "border-b border-ink/10 shadow-card" : ""
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Brand row */}
      <div className="flex items-center justify-between px-5 pt-2 pb-1.5">
        <div className="flex items-center -ml-1.5">
          <button
            type="button"
            aria-label={t("정보", "About")}
            className="touch-target rounded-full text-ink-soft active:bg-ink/5 active:text-ink transition"
            onClick={() => {
              tap();
              setAboutOpen(true);
            }}
          >
            <Info size={20} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            aria-label={t("문의 · 피드백", "Contact · Feedback")}
            className="touch-target rounded-full text-ink-soft active:bg-ink/5 active:text-ink transition"
            onClick={() => {
              tap();
              setFeedbackOpen(true);
            }}
          >
            <MessageSquarePlus size={20} strokeWidth={2.25} />
          </button>
          {isAdmin && (
            <Link
              to="/admin"
              onClick={tap}
              aria-label={t("관리자", "Admin")}
              className={`touch-target rounded-full transition ${
                path.startsWith("/admin")
                  ? "bg-ink text-white"
                  : "text-ink-soft active:bg-ink/5 active:text-ink"
              }`}
            >
              <Shield size={20} strokeWidth={2.25} />
            </Link>
          )}
        </div>
        <Link
          to="/"
          className="font-display text-[22px] uppercase leading-none tracking-wide text-ink"
        >
          ITJIMA
          <span className="ml-1 inline-block h-1.5 w-1.5 -translate-y-1 rounded-full bg-primary align-middle" />
        </Link>
        <div className="flex items-center gap-1 -mr-1">
          <LanguageToggle />
          {userId ? (
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                toast(t("로그아웃됨", "Signed out"));
              }}
              className="touch-target px-2 text-[10px] font-extrabold uppercase tracking-widest text-ink-soft"
              aria-label={t("로그아웃", "Sign out")}
            >
              {t("로그아웃", "Sign out")}
            </button>
          ) : (
            <Link
              to="/auth"
              onClick={tap}
              className="flex h-8 items-center rounded-full bg-ink px-3 text-[10px] font-extrabold uppercase tracking-widest text-white"
            >
              {t("로그인", "Sign in")}
            </Link>
          )}
        </div>
      </div>
      {/* Tabs — equal width, large tap target */}
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
      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  );
}
