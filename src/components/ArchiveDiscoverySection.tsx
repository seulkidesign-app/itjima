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
  onOpenMemory: (id: string) => void;
};

export function ArchiveDiscoverySection({
  lenses,
  items,
  onOpenMemory,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!lenses.length) return null;

  const itemById = new Map(items.map((it) => [it.id, it]));

  return (
    <section className="space-y-2.5">
      <p className="px-1 text-[12px] font-medium text-ink-soft/70">
        {t("이어지는 생각", "Threads that connect")}
      </p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {lenses.map((lens, i) => {
          const open = expandedId === lens.id;
          const title = lang === "en" ? lens.labelEn : lens.labelKo;
          return (
            <motion.button
              key={lens.id}
              type="button"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...SPRING_DEFAULT, delay: i * 0.04 }}
              onClick={() => setExpandedId(open ? null : lens.id)}
              className={`touch-press min-w-[156px] max-w-[210px] shrink-0 rounded-[18px] px-3.5 py-3 text-left transition-colors duration-200 ${
                open
                  ? "bg-primary/15 ring-1 ring-primary/20"
                  : "bg-ink/[0.03] ring-1 ring-ink/[0.04] active:bg-ink/[0.05]"
              }`}
            >
              <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink">
                {title}
              </p>
              <p className="mt-1 text-[11px] text-ink-soft/65">
                {t(`${lens.memoryIds.length}개`, `${lens.memoryIds.length} memories`)}
              </p>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {expandedId && (() => {
          const lens = lenses.find((l) => l.id === expandedId);
          if (!lens) return null;
          return (
            <motion.div
              key={lens.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING_DEFAULT}
              className="overflow-hidden"
            >
              <div className="space-y-1.5 rounded-[20px] bg-ink/[0.025] p-2.5">
                {lens.memoryIds.map((id, idx) => {
                  const it = itemById.get(id);
                  if (!it) return null;
                  const preview = (it.raw_text ?? it.text).trim();
                  return (
                    <motion.button
                      key={id}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...SPRING_DEFAULT, delay: idx * 0.05 }}
                      onClick={() => {
                        onOpenMemory(id);
                        setExpandedId(null);
                      }}
                      className="touch-press flex w-full items-center gap-2.5 rounded-[14px] bg-white/95 px-3 py-2.5 text-left ring-1 ring-ink/[0.04] active:scale-[0.995]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[13px] font-semibold text-ink">
                          {archiveDisplayTitle(id, it)}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-soft/80">
                          {preview}
                        </p>
                      </div>
                      <ChevronRight
                        size={14}
                        className="shrink-0 text-ink-soft/45"
                        aria-hidden
                      />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </section>
  );
}
