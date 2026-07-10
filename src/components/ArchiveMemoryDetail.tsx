import { motion, AnimatePresence } from "framer-motion";
import { X, Pin } from "lucide-react";
import type { ArchiveItem } from "@/lib/store";
import { archiveDisplayTitle } from "@/lib/archiveMeta";
import { ArchiveRelatedStrip } from "@/components/ArchiveRelatedStrip";
import { useT, useLang } from "@/lib/i18n";
import { useScrollLock } from "@/hooks/useScrollLock";

type DetailProps = {
  item: ArchiveItem | null;
  allItems: ArchiveItem[];
  pinned: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  onOpenRelated: (item: ArchiveItem) => void;
};

export function ArchiveMemoryDetail({
  item,
  allItems,
  pinned,
  onClose,
  onTogglePin,
  onOpenRelated,
}: DetailProps) {
  const t = useT();
  const { lang } = useLang();
  useScrollLock(!!item);

  const locale = lang === "en" ? "en-US" : "ko-KR";

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-[90] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label={t("닫기", "Close")}
            className="flex-1 bg-ink/35 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="max-h-[88vh] shrink-0 overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 shadow-float"
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-ink/12" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] text-ink-soft">
                  {new Date(item.created_at).toLocaleDateString(locale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <h2 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-ink">
                  {archiveDisplayTitle(item.id, item)}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="touch-target rounded-full text-ink-soft"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-[1.65] text-ink/90">
              {item.raw_text ?? item.text}
            </p>
            {item.images?.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto">
                {item.images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-24 w-24 rounded-[16px] object-cover ring-1 ring-ink/8"
                  />
                ))}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onTogglePin}
                className={`touch-press flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold ${
                  pinned
                    ? "bg-primary text-ink"
                    : "bg-ink/[0.05] text-ink-soft"
                }`}
              >
                <Pin size={14} className={pinned ? "fill-ink" : ""} />
                {pinned ? t("핀 해제", "Unpin") : t("자주 보기", "Pin")}
              </button>
            </div>
            <ArchiveRelatedStrip
              item={item}
              items={allItems}
              onSelect={onOpenRelated}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
