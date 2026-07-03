import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { ArchiveItem } from "@/lib/store";
import { archiveDisplayTitle } from "@/lib/archiveMeta";
import { useT, useLang } from "@/lib/i18n";
import type { MemoryLens } from "@/lib/memoryDiscovery";
import { SPRING_DEFAULT } from "@/lib/motion";

type Props = {
  lenses: MemoryLens[];
  items: ArchiveItem[];
  loading?: boolean;
  onOpenMemory: (id: string) => void;
};

const KIND_HINT: Record<
  MemoryLens["kind"],
  { ko: string; en: string }
> = {
  revisited: { ko: "자주 떠올리는", en: "Often revisited" },
  connected: { ko: "최근 이어진", en: "Recently connected" },
  similar: { ko: "닮은 생각", en: "Similar threads" },
  recurring: { ko: "반복되는 주제", en: "Recurring themes" },
  growing: { ko: "자라는 관심", en: "Growing interests" },
};

export function ArchiveDiscoverySection({
  lenses,
  items,
  loading,
  onOpenMemory,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading && lenses.length === 0) {
    return (
      <section className="pb-1">
        <div className="flex gap-2 overflow-hidden px-1">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-[72px] min-w-[168px] animate-pulse rounded-[20px] bg-ink/[0.04]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!lenses.length) return null;

  const itemById = new Map(items.map((it) => [it.id, it]));

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_DEFAULT, duration: 0.35 }}
      className="space-y-3"
    >
      <p className="px-1 text-[12px] font-medium text-ink-soft/75">
        {t("떠올려 볼 만한 연결", "Threads worth revisiting")}
      </p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {lenses.map((lens) => {
          const open = expandedId === lens.id;
          const hint = KIND_HINT[lens.kind];
          const title = lang === "en" ? lens.labelEn : lens.labelKo;
          return (
            <button
              key={lens.id}
              type="button"
              onClick={() => setExpandedId(open ? null : lens.id)}
              className={`touch-press min-w-[168px] max-w-[220px] shrink-0 rounded-[20px] px-4 py-3.5 text-left transition-colors ${
                open
                  ? "bg-primary/20 ring-1 ring-primary/25"
                  : "bg-ink/[0.035] ring-1 ring-ink/[0.04] active:bg-ink/[0.06]"
              }`}
            >
              <p className="text-[10px] font-medium text-ink-soft/70">
                {lang === "en" ? hint.en : hint.ko}
              </p>
              <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-snug text-ink">
                {title}
              </p>
              <p className="mt-1.5 text-[11px] text-ink-soft/75">
                {t(`${lens.memoryIds.length}개의 기억`, `${lens.memoryIds.length} memories`)}
              </p>
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {expandedId && (() => {
          const lens = lenses.find((l) => l.id === expandedId);
          if (!lens) return null;
          return (
            <motion.div
              key={lens.id}
              initial={{ opacity: 0, height: 0, scale: 0.98 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.98 }}
              transition={SPRING_DEFAULT}
              className="overflow-hidden"
            >
              <div className="space-y-2 rounded-[22px] bg-ink/[0.03] p-3">
                {lens.memoryIds.map((id) => {
                  const it = itemById.get(id);
                  if (!it) return null;
                  const preview = (it.raw_text ?? it.text).trim();
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        onOpenMemory(id);
                        setExpandedId(null);
                      }}
                      className="touch-press flex w-full items-center gap-3 rounded-[16px] bg-white/90 px-3.5 py-3 text-left shadow-sm ring-1 ring-ink/[0.04] active:scale-[0.99]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[14px] font-semibold text-ink">
                          {archiveDisplayTitle(id, it)}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-ink-soft/85">
                          {preview}
                        </p>
                      </div>
                      <ChevronRight
                        size={16}
                        className="shrink-0 text-ink-soft/50"
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </motion.section>
  );
}
