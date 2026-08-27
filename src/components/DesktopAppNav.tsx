import { Link, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  CalendarDays,
  MessageSquareText,
  Settings,
  User,
} from "lucide-react";
import { useState } from "react";
import { SettingsSheet } from "./SettingsSheet";
import { useT } from "@/lib/i18n";
import { useUserId } from "@/lib/store";
import { tap } from "@/lib/haptics";

/** Desktop primary nav — same IA as mobile, Quietly yellow language (Figma 319:2). */
export function DesktopAppNav() {
  const t = useT();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const userId = useUserId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const items = [
    {
      to: "/app" as const,
      label: t("남기기", "Capture"),
      ariaLabel: t("남기기", "Capture"),
      Icon: MessageSquareText,
    },
    {
      to: "/schedule" as const,
      label: t("일정", "Schedule"),
      ariaLabel: t("일정", "Schedule"),
      Icon: CalendarDays,
    },
    {
      to: "/archive" as const,
      label: t("보관함", "Archive"),
      ariaLabel: t("보관함", "Archive"),
      Icon: Archive,
    },
  ];

  return (
    <>
      <aside
        className="itjima-desktop-nav hidden shrink-0 flex-col border-r border-[var(--quietly-border)] bg-[var(--canvas,#faf8f5)] lg:flex"
        aria-label={t("주요 메뉴", "Primary navigation")}
      >
        <Link
          to="/"
          onClick={tap}
          className="itjima-desktop-brand flex min-h-14 items-center gap-2.5 px-5 no-underline"
          aria-label={t("잊지마 소개로 이동", "Open Itjima introduction")}
        >
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
            aria-hidden
          />
          <strong className="text-[17px] font-extrabold tracking-[-0.03em] text-ink">
            {t("잊지마", "Itjima")}
          </strong>
        </Link>

        <nav className="mt-4 flex flex-col gap-1.5 px-3">
          {items.map(({ to, label, ariaLabel, Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={tap}
                aria-label={ariaLabel}
                aria-current={active ? "page" : undefined}
                className={`itjima-desktop-nav-item flex min-h-12 items-center gap-3 rounded-full px-3.5 py-2.5 no-underline transition-colors ${
                  active
                    ? "bg-primary text-ink shadow-[var(--shadow-yellow)]"
                    : "text-ink hover:bg-ink/[0.04]"
                }`}
              >
                <Icon size={18} strokeWidth={2.1} aria-hidden />
                <strong className="text-[14px] font-bold tracking-[-0.015em]">
                  {label}
                </strong>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-3 pb-4">
          <button
            type="button"
            data-testid="open-settings"
            onClick={() => {
              tap();
              setSettingsOpen(true);
            }}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            className="itjima-desktop-settings flex min-h-[48px] w-full items-center gap-3 rounded-full border border-[var(--quietly-border)] bg-white px-3.5 py-3 text-left transition-colors hover:bg-ink/[0.03] active:bg-ink/[0.04]"
          >
            <span className="text-ink-soft">
              {userId ? <User size={18} aria-hidden /> : <Settings size={18} aria-hidden />}
            </span>
            <strong className="text-[13px] font-bold text-ink">
              {userId
                ? t("계정과 설정", "Account & settings")
                : t("로그인과 설정", "Sign in & settings")}
            </strong>
          </button>
        </div>
      </aside>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
