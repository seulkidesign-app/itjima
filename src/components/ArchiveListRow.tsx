import type { ArchiveItem } from "@/lib/store";
import { archiveDisplayTitle } from "@/lib/archiveMeta";
import { Pin } from "lucide-react";
import { useRef } from "react";
import { useT } from "@/lib/i18n";

export function ArchiveListRow({
  item,
  locale,
  categoryLabel,
  pinned,
  onOpen,
  onEditTitle,
}: {
  item: ArchiveItem;
  locale: string;
  categoryLabel: string;
  pinned?: boolean;
  onOpen: () => void;
  onEditTitle?: () => void;
}) {
  const t = useT();
  const title = archiveDisplayTitle(item.id, item);
  const saved = new Date(item.created_at).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const pressTimer = useRef<number | null>(null);
  const longFired = useRef(false);

  const clearPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <button
      type="button"
      onPointerDown={() => {
        longFired.current = false;
        clearPress();
        if (onEditTitle) {
          pressTimer.current = window.setTimeout(() => {
            longFired.current = true;
            onEditTitle();
          }, 480);
        }
      }}
      onPointerUp={() => {
        clearPress();
        if (!longFired.current) onOpen();
      }}
      onPointerLeave={clearPress}
      onPointerCancel={clearPress}
      className="w-full rounded-[18px] border border-ink/[0.05] bg-white px-4 py-3.5 text-left shadow-[0_1px_8px_-4px_rgba(0,0,0,0.08)] touch-press active:bg-ink/[0.02]"
    >
      <div className="flex items-start gap-2">
        {pinned && (
          <Pin
            size={14}
            className="mt-0.5 shrink-0 fill-primary text-primary"
            aria-label={t("고정", "Pinned")}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-[15px] font-semibold leading-snug text-ink">
            {item.text.trim() || title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-soft">
            <span className="rounded-full bg-ink/[0.05] px-2 py-0.5 font-medium">
              {categoryLabel}
            </span>
            <span>{saved}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
