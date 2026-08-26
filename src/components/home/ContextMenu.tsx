import {
  Wind,
  Trash2,
  Calendar,
  Archive as ArchiveIcon,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { FEATURES } from "@/lib/features";
import { useT } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";

type Props = {
  menuItem: InboxItem;
  onClose: () => void;
  onOpenCleanup: () => void;
  /** V0.2: open All Records browse (DecisionDeck one-by-one is unreachable). */
  onOpenAllRecords: () => void;
  onUnderstandAgain: (item: InboxItem) => void | Promise<void>;
  onOpenHomeSchedule: (item: InboxItem) => void;
  onMoveToArchive: (item: InboxItem) => void;
  onMoveToDelete: (item: InboxItem) => void;
};

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  buttonRef,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-3 rounded-full px-4 py-3 text-[15px] font-medium ${
        danger ? "text-meta" : "text-ink"
      } hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
    >
      {icon}
      {label}
    </button>
  );
}

export function ContextMenu({
  menuItem,
  onClose,
  onOpenCleanup,
  onOpenAllRecords,
  onUnderstandAgain,
  onOpenHomeSchedule,
  onMoveToArchive,
  onMoveToDelete,
}: Props) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      firstItemRef.current?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const buttons = Array.from(
        panelRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not([disabled])',
        ) ?? [],
      );
      if (!buttons.length) return;
      event.preventDefault();
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = current < 0 ? 0 : (current + delta + buttons.length) % buttons.length;
      buttons[next].focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
      });
    };
  }, [onClose]);

  let assignedFirst = false;
  const firstRef = () => {
    if (assignedFirst) return undefined;
    assignedFirst = true;
    return firstItemRef;
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col" role="presentation">
      <button
        type="button"
        aria-label={t("메뉴 닫기", "Close menu")}
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="menu"
        aria-label={t("기록 작업", "Capture actions")}
        data-testid="inbox-context-menu"
        className="glass-strong relative mt-auto animate-slide-up mx-5 mb-[100px] rounded-[24px] p-2 shadow-float"
      >
        {FEATURES.CLEANUP && (
          <MenuItem
            buttonRef={firstRef()}
            icon={<Wind size={18} aria-hidden />}
            label={t("가볍게 비우기", "Lighten up")}
            onClick={() => {
              onClose();
              onOpenCleanup();
            }}
          />
        )}
        <MenuItem
          buttonRef={firstRef()}
          icon={<BookOpen size={18} aria-hidden />}
          label={t("전체 기록", "All records")}
          onClick={() => {
            onClose();
            onOpenAllRecords();
          }}
        />
        {FEATURES.BRAIN_MIRROR && (
          <MenuItem
            icon={<Sparkles size={18} aria-hidden />}
            label={t("다시 살펴보기", "Look again")}
            onClick={() => {
              const target = menuItem;
              onClose();
              void onUnderstandAgain(target);
            }}
          />
        )}
        <MenuItem
          icon={<Calendar size={18} aria-hidden />}
          label={t("그때로 보내기", "Bring it back then")}
          onClick={() => {
            onClose();
            onOpenHomeSchedule(menuItem);
          }}
        />
        <MenuItem
          icon={<ArchiveIcon size={18} aria-hidden />}
          label={t("보관함에 맡기기", "Save to vault")}
          onClick={() => {
            onClose();
            onMoveToArchive(menuItem);
          }}
        />
        <MenuItem
          icon={<Trash2 size={18} aria-hidden />}
          label={t("삭제하기", "Delete")}
          danger
          onClick={() => {
            onClose();
            void onMoveToDelete(menuItem);
          }}
        />
      </div>
    </div>
  );
}
