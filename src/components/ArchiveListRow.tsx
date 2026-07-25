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
  const hasLink = /https?:\/\//i.test(item.text ?? "");
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
      className={`w-full rounded-[var(--radius-md)] border bg-white px-3.5 py-2.5 text-left shadow-card touch-press active:bg-ink/[0.02] ${
        pinned
          ? "border-primary/25 border-l-[3px] border-l-primary pl-[calc(0.875rem-2px)]"
          : "border-ink/[0.04]"
      }`}
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
          <p
            className={`whitespace-pre-wrap break-words text-[15px] font-medium leading-snug ${
              hasLink ? "text-[#1a5fb4] underline decoration-[#1a5fb4]/25 underline-offset-2" : "text-ink"
            }`}
          >
            {title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-soft/70">
            {!hasLink && (
              <span className="rounded-full bg-ink/[0.04] px-2 py-0.5 font-medium">
                {categoryLabel}
              </span>
            )}
            <span className="tabular-nums">{saved}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
