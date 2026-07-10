import { useMemo } from "react";
import { motion } from "framer-motion";
import { Pin } from "lucide-react";
import type { ArchiveItem } from "@/lib/store";
import { archiveDisplayTitle, readArchiveVisits } from "@/lib/archiveMeta";
import { useT, useLang } from "@/lib/i18n";
import { MOTION_CRAFT } from "@/lib/motionLanguage";
import {
  ArchiveTimelineStrip,
  filterByMonth,
  memoryBubbleSize,
} from "@/components/ArchiveMemorySpace";

type Props = {
  items: ArchiveItem[];
  pins: Set<string>;
  selectedMonth: string | null;
  onSelectMonth: (key: string | null) => void;
  onOpenDetail: (item: ArchiveItem) => void;
};

export function ArchiveConnectedGrid({
  items,
  pins,
  selectedMonth,
  onSelectMonth,
  onOpenDetail,
}: Props) {
  const t = useT();
  const visits = useMemo(() => readArchiveVisits(), [items.length]);
  const filtered = useMemo(
    () => filterByMonth(items, selectedMonth),
    [items, selectedMonth],
  );

  const clusters = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
    );
    const pinned = sorted.filter((it) => pins.has(it.id));
    const rest = sorted.filter((it) => !pins.has(it.id));
    return { pinned, rest };
  }, [filtered, pins]);

  return (
    <div className="space-y-5">
      <ArchiveTimelineStrip
        items={items}
        selectedMonth={selectedMonth}
        onSelectMonth={onSelectMonth}
      />
      <div className="archive-memory-space relative px-4 pb-8 pt-1">
        <div
          className="pointer-events-none absolute inset-0 rounded-[36px] opacity-70"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% 8%, oklch(0.94 0.1 95 / 0.22), transparent 72%), radial-gradient(ellipse 60% 50% at 80% 90%, oklch(0.92 0.06 240 / 0.08), transparent 70%)",
          }}
        />
        {clusters.pinned.length > 0 && (
          <section className="relative mb-4">
            <h2 className="mb-2 text-[12px] font-semibold text-ink-soft/80">
              {t("자주 보는 기억", "Often revisited")}
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {clusters.pinned.map((it) => (
                <MemoryBubble
                  key={it.id}
                  item={it}
                  size="lg"
                  pinned
                  onOpen={() => onOpenDetail(it)}
                />
              ))}
            </div>
          </section>
        )}
        <div className="relative grid grid-cols-2 gap-3">
          {clusters.rest.map((it, i) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...MOTION_CRAFT, delay: Math.min(i * 0.05, 0.3) }}
              className={memoryBubbleSize(it, visits) === "lg" ? "col-span-2" : ""}
            >
              <MemoryBubble
                item={it}
                size={memoryBubbleSize(it, visits)}
                onOpen={() => onOpenDetail(it)}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MemoryBubble({
  item,
  size,
  pinned,
  onOpen,
}: {
  item: ArchiveItem;
  size: "sm" | "md" | "lg";
  pinned?: boolean;
  onOpen: () => void;
}) {
  const { lang } = useLang();
  const title = archiveDisplayTitle(item.id, item);
  const date = new Date(item.created_at).toLocaleDateString(
    lang === "en" ? "en-US" : "ko-KR",
    { month: "short", day: "numeric" },
  );
  const pad =
    size === "lg" ? "px-5 py-6" : size === "md" ? "px-4 py-5" : "px-4 py-4";
  const titleSize =
    size === "lg" ? "text-[16px]" : size === "md" ? "text-[14px]" : "text-[13px]";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`touch-press w-full text-left rounded-[26px] bg-white/96 shadow-craft ring-1 ring-ink/[0.04] transition active:scale-[0.985] ${pad} ${
        pinned ? "ring-2 ring-primary/40" : ""
      }`}
    >
      {pinned && <Pin size={12} className="mb-1.5 fill-primary text-primary" />}
      <p className={`font-semibold leading-[1.45] tracking-[-0.015em] text-ink ${titleSize}`}>
        {title}
      </p>
      <p className="mt-1.5 text-[11px] font-medium tracking-[0.01em] text-ink-soft/70">
        {date}
      </p>
    </button>
  );
}
