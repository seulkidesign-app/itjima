import {
  Wind,
  Trash2,
  Calendar,
  Archive as ArchiveIcon,
  Sparkles,
  ListOrdered,
} from "lucide-react";
import { FEATURES } from "@/lib/features";
import { useT } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";

type Props = {
  menuItem: InboxItem;
  onClose: () => void;
  onOpenCleanup: () => void;
  onOpenDecisionDeck: () => void;
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
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-[15px] font-medium min-h-11 ${
        danger ? "text-meta" : "text-ink"
      } hover:bg-white/60`}
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
  onOpenDecisionDeck,
  onUnderstandAgain,
  onOpenHomeSchedule,
  onMoveToArchive,
  onMoveToDelete,
}: Props) {
  const t = useT();

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      data-testid="inbox-context-menu"
      onClick={onClose}
    >
      <div className="flex-1 bg-ink/30 backdrop-blur-sm animate-fade-in" />
      <div
        className="glass-strong animate-slide-up mx-5 mb-[100px] rounded-[24px] p-2 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        {FEATURES.CLEANUP && (
          <MenuItem
            icon={<Wind size={18} />}
            label={t("가볍게 비우기", "Lighten up")}
            onClick={() => {
              onClose();
              onOpenCleanup();
            }}
          />
        )}
        <MenuItem
          icon={<ListOrdered size={18} />}
          label={t("하나씩 정리하기", "Sort one by one")}
          onClick={() => {
            onClose();
            onOpenDecisionDeck();
          }}
        />
        {FEATURES.BRAIN_MIRROR && (
          <MenuItem
            icon={<Sparkles size={18} />}
            label={t("다시 살펴보기", "Look again")}
            onClick={() => {
              const target = menuItem;
              onClose();
              void onUnderstandAgain(target);
            }}
          />
        )}
        <MenuItem
          icon={<Calendar size={18} />}
          label={t("그때로 보내기", "Bring it back then")}
          onClick={() => {
            onClose();
            onOpenHomeSchedule(menuItem);
          }}
        />
        <MenuItem
          icon={<ArchiveIcon size={18} />}
          label={t("보관함에 맡기기", "Save to vault")}
          onClick={() => {
            onClose();
            onMoveToArchive(menuItem);
          }}
        />
        <MenuItem
          icon={<Trash2 size={18} />}
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
