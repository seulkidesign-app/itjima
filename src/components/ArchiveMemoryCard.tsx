import { motion, AnimatePresence } from "framer-motion";
import { Pin, Pencil, Trash2 } from "lucide-react";
import type { ArchiveItem } from "@/lib/store";
import { archiveDisplayTitle } from "@/lib/archiveMeta";
import { ArchiveRelatedStrip } from "@/components/ArchiveRelatedStrip";
import { useT } from "@/lib/i18n";
import { SPRING_DEFAULT } from "@/lib/motion";

type Props = {
  item: ArchiveItem;
  locale: string;
  expanded: boolean;
  selected: boolean;
  selecting: boolean;
  pinned: boolean;
  isDragging?: boolean;
  showSemanticHint?: boolean;
  allItems: ArchiveItem[];
  onToggleExpand: () => void;
  onTogglePin: () => void;
  onEditTitle: () => void;
  onDelete: () => void;
  onJumpTo: (id: string) => void;
};

export function ArchiveMemoryCard({
  item,
  locale,
  expanded,
  selected,
  selecting,
  pinned,
  isDragging,
  showSemanticHint,
  allItems,
  onToggleExpand,
  onTogglePin,
  onEditTitle,
  onDelete,
  onJumpTo,
}: Props) {
  const t = useT();
  const title = archiveDisplayTitle(item.id, item);
  const body = item.raw_text ?? item.text;
  const dateLabel = new Date(item.created_at).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });

  const handleActivate = () => {
    if (selecting) return;
    onToggleExpand();
  };

  return (
    <div
      className={`relative transition-opacity duration-200 ${
        isDragging ? "opacity-35" : ""
      } ${selected ? "ring-2 ring-primary/80 ring-offset-2 ring-offset-white rounded-[24px]" : ""}`}
    >
      {selecting && (
        <div
          className={`absolute left-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
            selected ? "border-primary bg-primary" : "border-ink/15 bg-white"
          }`}
          aria-hidden
        >
          {selected && (
            <span className="text-[11px] font-bold text-ink">✓</span>
          )}
        </div>
      )}

      <div
        role={selecting ? undefined : "button"}
        tabIndex={selecting ? undefined : 0}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (selecting) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        className={`block w-full px-5 py-4 text-left ${
          selecting ? "pl-12" : "cursor-pointer"
        }`}
      >
        <div className="flex gap-3">
          {item.images?.[0] && (
            <img
              src={item.images[0]}
              alt=""
              className="h-[4.25rem] w-[4.25rem] shrink-0 rounded-[18px] object-cover ring-1 ring-ink/5"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <p
                className={`flex-1 font-semibold leading-snug text-ink ${
                  expanded ? "text-[17px]" : "text-[16px] line-clamp-2"
                }`}
              >
                {pinned && (
                  <Pin
                    size={13}
                    className="mr-1.5 inline -translate-y-px fill-primary text-primary"
                    aria-hidden
                  />
                )}
                {title}
              </p>
              {!selecting && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin();
                  }}
                  className="touch-target -mr-1 shrink-0 rounded-full text-ink-soft active:bg-ink/5"
                  aria-label={
                    pinned
                      ? t("핀 해제", "Unpin")
                      : t("자주 보기", "Pin")
                  }
                >
                  <Pin
                    size={16}
                    className={
                      pinned ? "fill-primary text-primary" : "text-ink-soft/70"
                    }
                  />
                </button>
              )}
            </div>

            {!expanded && (
              <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink-soft/90">
                {body}
              </p>
            )}

            <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-ink-soft/75">
              <span>{dateLabel}</span>
              {showSemanticHint && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-ink/80">
                  {t("떠올린 것", "recalled")}
                </span>
              )}
              {!expanded && !selecting && (
                <span className="ml-auto text-[10px] text-ink-soft/55">
                  {t("탭하여 펼치기", "Tap to open")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && !selecting && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING_DEFAULT}
            className="overflow-hidden"
          >
            <div className="border-t border-ink/[0.06] px-5 pb-4 pt-3">
              <p className="whitespace-pre-wrap text-[15px] leading-[1.65] text-ink/90">
                {body}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={onEditTitle}
                  className="touch-press inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-2 text-[12px] font-semibold text-ink-soft"
                >
                  <Pencil size={13} />
                  {t("제목", "Title")}
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="touch-press inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-2 text-[12px] font-semibold text-ink-soft"
                >
                  <Trash2 size={13} />
                  {t("지우기", "Remove")}
                </button>
              </div>
              <ArchiveRelatedStrip
                item={item}
                items={allItems}
                onSelect={(rel) => onJumpTo(rel.id)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
