import { useMemo } from "react";
import { motion } from "framer-motion";
import { Pin } from "lucide-react";
import type { ArchiveItem } from "@/lib/store";
import { archiveDisplayTitle, readArchiveVisits } from "@/lib/archiveMeta";
import { useT, useLang } from "@/lib/i18n";
import { MOTION_THINKING } from "@/lib/motionLanguage";
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
    <div className="space-y-4">
      <ArchiveTimelineStrip
        items={items}
        selectedMonth={selectedMonth}
        onSelectMonth={onSelectMonth}
      />
      <div className="archive-memory-space relative px-5 pb-6">
        <div
          className="pointer-events-none absolute inset-0 rounded-[32px] opacity-60"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 20%, oklch(0.92 0.12 95 / 0.18), transparent 70%)",
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
        <div className="relative grid grid-cols-2 gap-2.5">
          {clusters.rest.map((it, i) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...MOTION_THINKING, delay: Math.min(i * 0.04, 0.24) }}
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
    size === "lg" ? "px-5 py-5" : size === "md" ? "px-4 py-4" : "px-3.5 py-3.5";
  const titleSize =
    size === "lg" ? "text-[15px]" : size === "md" ? "text-[14px]" : "text-[13px]";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`touch-press w-full text-left rounded-[24px] bg-white/95 shadow-card ring-1 ring-ink/[0.05] transition active:scale-[0.98] ${pad} ${
        pinned ? "ring-2 ring-primary/45" : ""
      }`}
    >
      {pinned && <Pin size={12} className="mb-1 fill-primary text-primary" />}
      <p className={`font-bold leading-snug text-ink ${titleSize}`}>{title}</p>
      <p className="mt-1 text-[11px] text-ink-soft/75">{date}</p>
    </button>
  );
}
