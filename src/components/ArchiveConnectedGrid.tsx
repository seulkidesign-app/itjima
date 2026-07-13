import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ArchiveItem } from "@/lib/store";
import { archiveDisplayTitle, readArchiveVisits } from "@/lib/archiveMeta";
import { useT } from "@/lib/i18n";
import {
  ArchiveTimelineStrip,
  filterByMonth,
  computeMemorySpaceLayout,
  MemorySpaceNode,
  type LayoutNode,
} from "@/components/ArchiveMemorySpace";

type Props = {
  items: ArchiveItem[];
  pins: Set<string>;
  selectedMonth: string | null;
  onSelectMonth: (key: string | null) => void;
  onOpenDetail: (item: ArchiveItem, clusterIds?: string[]) => void;
};

export function ArchiveConnectedGrid({
  items,
  pins: _pins,
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

  const layout = useMemo(
    () => computeMemorySpaceLayout(filtered, visits),
    [filtered, visits],
  );

  const [overflowItems, setOverflowItems] = useState<ArchiveItem[] | null>(
    null,
  );

  const itemById = useMemo(() => {
    const m = new Map<string, ArchiveItem>();
    for (const it of filtered) m.set(it.id, it);
    return m;
  }, [filtered]);

  const openNode = (node: LayoutNode) => {
    const clusterIds = layout.clusterMap.get(node.item.id);
    onOpenDetail(node.item, clusterIds);
  };

  const canvasHeight = useMemo(() => {
    const clusterCount = layout.overflowChips.length + layout.lines.length;
    const base = 420;
    if (layout.nodes.filter((n) => n.role === "single").length > 4) {
      return base + 80;
    }
    if (clusterCount > 6) return base + 60;
    return base;
  }, [layout]);

  return (
    <div className="space-y-3">
      <ArchiveTimelineStrip
        items={items}
        selectedMonth={selectedMonth}
        onSelectMonth={onSelectMonth}
        dark
      />
      <div className="relative px-3 pb-4">
        <div
          className="archive-space-canvas archive-starfield relative overflow-hidden rounded-[32px]"
          style={{
            minHeight: canvasHeight,
            background:
              "radial-gradient(ellipse 85% 65% at 50% 18%, rgba(245,239,216,0.06), transparent 70%)",
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {layout.lines.map((line, i) => (
              <line
                key={i}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="var(--archive-line)"
                strokeWidth="0.15"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div className="relative h-full" style={{ minHeight: canvasHeight }}>
            {layout.nodes.map((node, i) => (
              <MemorySpaceNode
                key={node.id}
                node={node}
                onOpen={() => openNode(node)}
              />
            ))}

            {layout.overflowChips.map((chip) => (
              <button
                key={chip.clusterId}
                type="button"
                onClick={() => {
                  const list = chip.itemIds
                    .map((id) => itemById.get(id))
                    .filter(Boolean) as ArchiveItem[];
                  setOverflowItems(list);
                }}
                className="archive-space-overflow touch-press absolute z-10 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition active:scale-95"
                style={{
                  left: `calc(${chip.x}% - 16px)`,
                  top: `calc(${chip.y}% - 12px)`,
                }}
              >
                +{chip.count}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {overflowItems && (
          <motion.div
            className="fixed inset-0 z-[85] flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label={t("닫기", "Close")}
              className="flex-1 bg-black/45 backdrop-blur-sm"
              onClick={() => setOverflowItems(null)}
            />
            <motion.div
              role="dialog"
              aria-modal
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="archive-detail-sheet max-h-[72dvh] shrink-0 overflow-y-auto rounded-t-[28px] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4"
            >
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15" />
              <h2 className="text-[17px] font-bold">
                {t("연결된 기억", "Connected memories")}
              </h2>
              <ul className="mt-4 space-y-2">
                {overflowItems.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const clusterIds = layout.clusterMap.get(it.id);
                        setOverflowItems(null);
                        onOpenDetail(it, clusterIds);
                      }}
                      className="touch-press w-full rounded-[16px] px-3 py-3 text-left archive-detail-chip active:opacity-80"
                    >
                      <p className="line-clamp-2 text-[14px] font-semibold">
                        {archiveDisplayTitle(it.id, it)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
