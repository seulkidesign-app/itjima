import { motion, AnimatePresence } from "framer-motion";
import { X, Pin } from "lucide-react";
import type { ArchiveItem } from "@/lib/store";
import { archiveDisplayTitle } from "@/lib/archiveMeta";
import { useT, useLang } from "@/lib/i18n";
import { useScrollLock } from "@/hooks/useScrollLock";

type DetailProps = {
  item: ArchiveItem | null;
  allItems: ArchiveItem[];
  pinned: boolean;
  clusterMemberIds?: string[];
  dark?: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  onOpenRelated: (item: ArchiveItem) => void;
};

function relativeTime(iso: string, lang: "ko" | "en") {
  const days = Math.floor(
    (Date.now() - +new Date(iso)) / (24 * 60 * 60 * 1000),
  );
  if (days < 1) return lang === "en" ? "Today" : "오늘";
  if (days < 30) {
    return lang === "en" ? `${days}d ago` : `${days}일 전`;
  }
  const months = Math.floor(days / 30);
  return lang === "en" ? `${months}mo ago` : `${months}개월 전`;
}

export function ArchiveMemoryDetail({
  item,
  allItems,
  pinned,
  clusterMemberIds,
  dark = false,
  onClose,
  onTogglePin,
  onOpenRelated,
}: DetailProps) {
  const t = useT();
  const { lang } = useLang();
  useScrollLock(!!item);

  const displayTitle = item ? archiveDisplayTitle(item.id, item) : "";
  const bodyText = item ? (item.raw_text ?? item.text) : "";
  const headline = bodyText.trim() || displayTitle;

  const connectedMembers = (() => {
    if (!item || !clusterMemberIds?.length) return [];
    return clusterMemberIds
      .filter((id) => id !== item.id)
      .map((id) => allItems.find((x) => x.id === id))
      .filter(Boolean) as ArchiveItem[];
  })();

  const sheetClass = dark
    ? "archive-detail-sheet max-h-[88dvh] shrink-0 overflow-y-auto rounded-t-[30px] px-6 pb-[calc(env(safe-area-inset-bottom)+1.75rem)] pt-5 shadow-[0_-20px_60px_rgba(0,0,0,0.45)]"
    : "max-h-[88vh] shrink-0 overflow-y-auto rounded-t-[30px] bg-white px-6 pb-[calc(env(safe-area-inset-bottom)+1.75rem)] pt-5 shadow-float";

  const backdropClass = dark
    ? "flex-1 bg-black/50 backdrop-blur-sm"
    : "flex-1 bg-ink/35 backdrop-blur-sm";

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
            className={backdropClass}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 32,
              mass: 0.95,
            }}
            className={sheetClass}
          >
            <div
              className={`mx-auto mb-3 h-1 w-9 rounded-full ${
                dark ? "bg-white/15" : "bg-ink/12"
              }`}
            />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`text-[12px] ${
                    dark ? "text-[color:var(--archive-text-soft)]" : "text-ink-soft"
                  }`}
                >
                  {displayTitle} · {relativeTime(item.created_at, lang)}
                </p>
                <h2
                  className={`mt-1 text-[22px] font-bold tracking-[-0.02em] ${
                    dark ? "text-[color:var(--archive-text)]" : "text-ink"
                  }`}
                >
                  {headline}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`touch-target rounded-full ${
                  dark ? "text-[color:var(--archive-text-soft)]" : "text-ink-soft"
                }`}
              >
                <X size={20} />
              </button>
            </div>
            {item.images?.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto">
                {item.images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className={`h-24 w-24 rounded-[16px] object-cover ${
                      dark ? "ring-1 ring-white/10" : "ring-1 ring-ink/8"
                    }`}
                  />
                ))}
              </div>
            )}
            {connectedMembers.length > 0 && (
              <div className="mt-5">
                <p
                  className={`text-[12px] font-medium ${
                    dark ? "text-[color:var(--archive-text-soft)]" : "text-ink-soft/70"
                  }`}
                >
                  {t("연결된 기억", "Connected memories")}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {connectedMembers.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => onOpenRelated(rel)}
                      className={`touch-press rounded-full px-3.5 py-2 text-[13px] font-semibold transition active:scale-[0.98] ${
                        dark
                          ? "archive-detail-chip"
                          : "bg-ink/[0.05] text-ink"
                      }`}
                    >
                      {archiveDisplayTitle(rel.id, rel)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onTogglePin}
                className={`touch-press flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold ${
                  pinned
                    ? dark
                      ? "bg-[color:var(--archive-chip-active)] text-[color:var(--archive-chip-active-text)]"
                      : "bg-primary text-ink"
                    : dark
                      ? "archive-detail-chip"
                      : "bg-ink/[0.05] text-ink-soft"
                }`}
              >
                <Pin size={14} className={pinned ? "fill-current" : ""} />
                {pinned ? t("핀 해제", "Unpin") : t("자주 보기", "Pin")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
