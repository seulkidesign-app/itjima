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
      to: "/app" as const,
      label: t("남기기", "Capture"),
      ariaLabel: t("남기기", "Capture"),
      description: t(
        "말하듯 일정과 할 일을 입력",
        "Capture plans in natural language",
      ),
      Icon: MessageSquareText,
    },
    {
      to: "/schedule" as const,
      label: t("할 일·일정", "Tasks & schedule"),
      ariaLabel: t(
        "할 일·일정",
        "Schedule — tasks and undated to-dos",
      ),
      description: t(
        "날짜 없는 할 일과 예정된 일정",
        "Review tasks and scheduled plans",
      ),
      Icon: CalendarDays,
    },
    {
      to: "/archive" as const,
      label: t("보관함", "Archive"),
      ariaLabel: t("보관함", "Archive"),
      description: t(
        "행동이 필요 없는 정보를 보관",
        "Keep reference material for later",
      ),
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
          onClick={tap}
          className="itjima-desktop-brand flex min-h-16 items-center gap-3 px-5 no-underline"
          aria-label={t("잊지마 소개로 이동", "Open Itjima introduction")}
        >
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-primary text-[13px] font-black text-ink shadow-card">
            IJ
          </span>
          <span>
            <strong className="block font-display text-[18px] uppercase tracking-[0.06em] text-ink">
              ITJIMA
            </strong>
            <small className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-ink/38">
              {t("말하듯 남기는 일정", "Natural scheduling")}
            </small>
          </span>
        </Link>

        <nav className="mt-5 flex flex-col gap-1.5 px-3">
          {items.map(({ to, label, ariaLabel, description, Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={tap}
                aria-label={ariaLabel}
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

        <div className="mx-4 mt-5 rounded-[16px] border border-ink/[0.06] bg-ink/[0.025] px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/36">
            {t("기본 원칙", "Core principle")}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold leading-[1.55] text-ink-soft">
            {t(
              "확실한 정보는 채우고, 애매한 부분만 확인해요.",
              "Fill what is clear. Confirm only what matters.",
            )}
          </p>
        </div>

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
            className="flex min-h-[58px] w-full items-center gap-3 rounded-[18px] border border-ink/[0.07] bg-white/74 px-3.5 text-left shadow-card transition-colors hover:bg-white active:bg-ink/[0.04]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-ink/[0.055] text-ink-soft">
              {userId ? <User size={18} aria-hidden /> : <Settings size={18} aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-[13px] font-bold text-ink">
                {userId
                  ? t("계정과 설정", "Account & settings")
                  : t("로그인과 설정", "Sign in & settings")}
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
