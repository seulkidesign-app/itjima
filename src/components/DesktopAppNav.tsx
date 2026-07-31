import { Link, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  CalendarDays,
  ChevronRight,
  MessageSquareText,
  Settings,
  User,
} from "lucide-react";
import { useState } from "react";
import { SettingsSheet } from "./SettingsSheet";
import { useT } from "@/lib/i18n";
import { useUserId } from "@/lib/store";
import { tap } from "@/lib/haptics";

export function DesktopAppNav() {
  const t = useT();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const userId = useUserId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const items = [
    {
      to: "/" as const,
      label: t("남기기", "Capture"),
      description: t("일정과 할 일을 자연어로 입력", "Capture plans in natural language"),
      Icon: MessageSquareText,
    },
    {
      to: "/schedule" as const,
      label: t("일정", "Schedule"),
      description: t("오늘과 예정된 일정 확인", "Review today and upcoming plans"),
      Icon: CalendarDays,
    },
    {
      to: "/archive" as const,
      label: t("보관함", "Archive"),
      description: t("나중을 위해 남긴 내용 찾기", "Find what you saved for later"),
      Icon: Archive,
    },
  ];

  return (
    <>
      <aside
        className="itjima-desktop-nav hidden shrink-0 flex-col border-r border-ink/[0.07] lg:flex"
        aria-label={t("주요 메뉴", "Primary navigation")}
      >
        <Link
          to="/"
          className="itjima-desktop-brand flex min-h-16 items-center gap-3 px-5 no-underline"
          aria-label={t("Itjima 남기기 화면", "Itjima Capture")}
        >
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-primary text-[13px] font-black text-ink shadow-card">
            IJ
          </span>
          <span>
            <strong className="block font-display text-[18px] uppercase tracking-[0.06em] text-ink">
              ITJIMA
            </strong>
            <small className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-ink/38">
              {t("자연어 일정", "Natural scheduling")}
            </small>
          </span>
        </Link>

        <nav className="mt-5 flex flex-col gap-1.5 px-3">
          {items.map(({ to, label, description, Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={tap}
                aria-current={active ? "page" : undefined}
                className={`itjima-desktop-nav-item group flex min-h-[66px] items-center gap-3 rounded-[18px] px-3.5 py-2.5 no-underline transition-colors ${
                  active
                    ? "bg-ink text-white shadow-card"
                    : "text-ink hover:bg-ink/[0.055]"
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-[12px] ${
                    active ? "bg-white/14" : "bg-ink/[0.055] text-ink-soft"
                  }`}
                >
                  <Icon size={18} strokeWidth={2.05} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[14px] font-bold tracking-[-0.015em]">
                    {label}
                  </strong>
                  <small
                    className={`mt-0.5 block truncate text-[10.5px] font-medium ${
                      active ? "text-white/56" : "text-ink-soft"
                    }`}
                  >
                    {description}
                  </small>
                </span>
                <ChevronRight
                  size={15}
                  className={active ? "text-white/42" : "text-ink/18"}
                  aria-hidden
                />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-3 pb-4">
          <button
            type="button"
            onClick={() => {
              tap();
              setSettingsOpen(true);
            }}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            className="flex min-h-[58px] w-full items-center gap-3 rounded-[18px] border border-ink/[0.07] bg-white/74 px-3.5 text-left shadow-card transition-colors hover:bg-white active:bg-ink/[0.04]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-ink/[0.055] text-ink-soft">
              {userId ? <User size={18} aria-hidden /> : <Settings size={18} aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-[13px] font-bold text-ink">
                {userId ? t("계정과 설정", "Account & settings") : t("로그인과 설정", "Sign in & settings")}
              </strong>
              <small className="mt-0.5 block truncate text-[10.5px] font-medium text-ink-soft">
                {t("언어·알림·데이터 관리", "Language, reminders, and data")}
              </small>
            </span>
            <ChevronRight size={15} className="text-ink/20" aria-hidden />
          </button>
        </div>
      </aside>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
