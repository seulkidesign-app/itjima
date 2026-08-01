import { Link, useRouterState } from "@tanstack/react-router";
import { Archive, CalendarDays, MessageSquareText, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { useT } from "@/lib/i18n";
import { SPRING_TAB } from "@/lib/motion";
import { useUserId } from "@/lib/store";
import { tap } from "@/lib/haptics";
import { SettingsSheet } from "./SettingsSheet";

export function TopNav() {
  const t = useT();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const userId = useUserId();
  const tabs = [
    {
      to: "/",
      label: t("남기기", "Capture"),
      ariaLabel: t("남기기", "Capture"),
      Icon: MessageSquareText,
    },
    {
      to: "/schedule",
      label: t("할 일·일정", "Tasks & schedule"),
      ariaLabel: t(
        "할 일·일정",
        "Schedule — tasks and undated to-dos",
      ),
      Icon: CalendarDays,
    },
    {
      to: "/archive",
      label: t("보관함", "Archive"),
      ariaLabel: t("보관함", "Archive"),
      Icon: Archive,
    },
  ] as const;

  const mobileSettingsRef = useRef<HTMLButtonElement | null>(null);
  const tabletSettingsRef = useRef<HTMLButtonElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const element = document.getElementById("phone-scroll");
    if (!element) return;
    const onScroll = () => setScrolled(element.scrollTop > 4);
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, []);

  const openSettings = () => {
    tap();
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    const restoreFocus = () => {
      const trigger = [mobileSettingsRef.current, tabletSettingsRef.current].find(
        (element) => element && element.getClientRects().length > 0,
      );
      trigger?.focus({ preventScroll: true });
    };
    queueMicrotask(restoreFocus);
    window.requestAnimationFrame(() => {
      restoreFocus();
      window.requestAnimationFrame(restoreFocus);
    });
  };

  const renderBrand = (className: string) => (
    <Link
      to="/"
      aria-label={t("잊지마 홈", "Itjima home")}
      className={className}
    >
      ITJIMA
      <span className="ml-1 inline-block h-1.5 w-1.5 -translate-y-1 rounded-full bg-primary align-middle" />
    </Link>
  );

  return (
    <>
      <div className="mobile-app-chrome sm:hidden">
        <header
          className={`app-top-nav mobile-app-header itjima-glass-chrome relative z-40 shrink-0 transition-shadow ${
            scrolled ? "border-b border-ink/10 shadow-card" : ""
          }`}
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mobile-app-header-bar flex min-h-[52px] items-center justify-between gap-3 px-4 py-1.5">
            {renderBrand(
              "app-brand-trigger rounded-[12px] px-1 py-1 font-display text-[19px] uppercase leading-none tracking-wide text-ink",
            )}
            <button
              ref={mobileSettingsRef}
              type="button"
              data-testid="open-settings"
              aria-label={t("설정 열기", "Open settings")}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              onClick={openSettings}
              className="mobile-account-button touch-target flex min-h-11 items-center gap-1.5 rounded-full border border-ink/10 bg-white/88 px-3 text-ink-soft shadow-card"
            >
              <User size={16} strokeWidth={2.1} aria-hidden />
              <span className="max-w-[4.5rem] truncate text-[11px] font-semibold">
                {userId ? t("계정", "Account") : t("로그인", "Sign in")}
              </span>
            </button>
          </div>
        </header>

        <LayoutGroup id="mobile-primary-navigation">
          <nav
            className="mobile-bottom-nav itjima-glass-chrome"
            aria-label={t("주요 메뉴", "Primary navigation")}
          >
            {tabs.map(({ to, label, ariaLabel, Icon }) => {
              const active = path === to;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={tap}
                  aria-label={ariaLabel}
                  aria-current={active ? "page" : undefined}
                  className={`mobile-bottom-nav-item relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[16px] px-2 py-1.5 text-[10.5px] font-semibold no-underline transition-colors ${
                    active ? "text-ink" : "text-ink-soft"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="mobile-nav-active"
                      className="absolute inset-1 rounded-[14px] bg-ink/[0.07]"
                      transition={SPRING_TAB}
                      aria-hidden
                    />
                  )}
                  <Icon className="relative z-[1]" size={20} strokeWidth={2.05} aria-hidden />
                  <span className="relative z-[1] truncate">{label}</span>
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
      </div>

      <header
        className={`tablet-app-nav app-top-nav itjima-glass-chrome relative z-40 hidden shrink-0 items-center gap-4 border-b border-ink/[0.07] px-6 py-3 sm:flex lg:hidden ${
          scrolled ? "shadow-card" : ""
        }`}
      >
        {renderBrand(
          "app-brand-trigger shrink-0 rounded-[12px] px-1 py-1 font-display text-[19px] uppercase leading-none tracking-wide text-ink",
        )}

        <LayoutGroup id="tablet-primary-navigation">
          <nav
            className="tablet-segmented-nav mx-auto flex min-w-0 max-w-[560px] flex-1 items-center rounded-[18px] border border-ink/[0.07] bg-ink/[0.035] p-1"
            aria-label={t("주요 메뉴", "Primary navigation")}
          >
            {tabs.map(({ to, label, ariaLabel, Icon }) => {
              const active = path === to;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={tap}
                  aria-label={ariaLabel}
                  aria-current={active ? "page" : undefined}
                  className={`tablet-segmented-nav-item relative flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-[14px] px-3 text-[13px] font-semibold no-underline transition-colors ${
                    active ? "text-ink" : "text-ink-soft"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="tablet-nav-active"
                      className="absolute inset-0 rounded-[14px] bg-white shadow-card"
                      transition={SPRING_TAB}
                      aria-hidden
                    />
                  )}
                  <Icon className="relative z-[1] shrink-0" size={18} strokeWidth={2} aria-hidden />
                  <span className="relative z-[1] truncate">{label}</span>
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>

        <button
          ref={tabletSettingsRef}
          type="button"
          data-testid="open-settings"
          aria-label={t("설정 열기", "Open settings")}
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          onClick={openSettings}
          className="tablet-account-button touch-target flex min-h-11 shrink-0 items-center gap-2 rounded-[14px] border border-ink/[0.08] bg-white/84 px-3.5 text-ink-soft shadow-card"
        >
          <User size={17} strokeWidth={2.1} aria-hidden />
          <span className="max-w-[5.5rem] truncate text-[12px] font-semibold">
            {userId ? t("계정", "Account") : t("로그인", "Sign in")}
          </span>
        </button>
      </header>

      <SettingsSheet open={settingsOpen} onClose={closeSettings} />
    </>
  );
}
