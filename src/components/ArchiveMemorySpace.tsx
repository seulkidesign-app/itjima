import { useMemo } from "react";
import type { ArchiveItem } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { archiveDisplayTitle } from "@/lib/archiveMeta";
import {
  findRelatedArchiveItems,
  memorySimilarity,
} from "@/lib/archiveSearch";
import {
  discoverMemoryLenses,
  STRONG_LINK,
} from "@/lib/memoryDiscovery";

type Props = {
  items: ArchiveItem[];
  selectedMonth: string | null;
  onSelectMonth: (key: string | null) => void;
  dark?: boolean;
};

export type MemorySpaceLayout = {
  nodes: LayoutNode[];
  lines: LayoutLine[];
  overflowChips: OverflowChip[];
  clusterMap: Map<string, string[]>;
};

export type LayoutNode = {
  id: string;
  item: ArchiveItem;
  x: number;
  y: number;
  role: "anchor" | "satellite" | "single";
  size: "sm" | "md" | "lg";
  clusterId?: string;
};

export type LayoutLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type OverflowChip = {
  clusterId: string;
  x: number;
  y: number;
  count: number;
  itemIds: string[];
};

const MAX_CLUSTER_NODES = 8;
const MAX_SATELLITES = MAX_CLUSTER_NODES - 1;

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ArchiveTimelineStrip({
  items,
  selectedMonth,
  onSelectMonth,
  dark = false,
}: Props) {
  const t = useT();

  const months = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) {
      const k = monthKey(it.created_at);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 8);
  }, [items]);

  if (months.length < 2) return null;

  const chipBase = dark
    ? "archive-space-chip text-[12px] font-semibold"
    : "bg-ink/[0.05] text-[12px] font-semibold text-ink-soft";
  const chipActive = dark
    ? "archive-space-chip-active"
    : "bg-ink text-white";
  const chipMonthActive = dark
    ? "archive-space-chip-active"
    : "bg-primary text-ink shadow-card";
  const labelClass = dark
    ? "text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--archive-text-soft)]"
    : "text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft/70";

  return (
    <div className="px-5 pb-2">
      <p className={`mb-2 ${labelClass}`}>{t("시간", "Timeline")}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onSelectMonth(null)}
          className={`shrink-0 rounded-full px-3.5 py-2 transition ${
            selectedMonth === null ? chipActive : chipBase
          }`}
        >
          {t("전체", "All")}
        </button>
        {months.map(([key, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelectMonth(key)}
            className={`shrink-0 rounded-full px-3.5 py-2 transition ${
              selectedMonth === key ? chipMonthActive : chipBase
            }`}
          >
            {key.slice(5)}
            <span className="ml-1 text-[10px] opacity-70">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function filterByMonth(items: ArchiveItem[], month: string | null) {
  if (!month) return items;
  return items.filter((it) => monthKey(it.created_at) === month);
}

export function memoryBubbleSize(
  item: ArchiveItem,
  visits: Record<string, number>,
): "sm" | "md" | "lg" {
  const v = visits[item.id] ?? 0;
  const ageDays =
    (Date.now() - +new Date(item.created_at)) / (24 * 60 * 60 * 1000);
  if (v >= 3) return "lg";
  if (ageDays < 14) return "md";
  return "sm";
}

function pickAnchor(
  members: ArchiveItem[],
  visits: Record<string, number>,
): ArchiveItem {
  return [...members].sort((a, b) => {
    const dv = (visits[b.id] ?? 0) - (visits[a.id] ?? 0);
    if (dv !== 0) return dv;
    return +new Date(a.created_at) - +new Date(b.created_at);
  })[0];
}

function expandCluster(
  cluster: ArchiveItem[],
  allItems: ArchiveItem[],
  assigned: Set<string>,
) {
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const candidate of allItems) {
      if (assigned.has(candidate.id)) continue;
      const maxSim = Math.max(
        ...cluster.map((m) => memorySimilarity(candidate, m, allItems)),
      );
      if (maxSim >= STRONG_LINK) {
        cluster.push(candidate);
        assigned.add(candidate.id);
        expanded = true;
      }
    }
  }
}

function buildArchiveClusters(
  items: ArchiveItem[],
  visits: Record<string, number>,
): { clusters: ArchiveItem[][]; singles: ArchiveItem[] } {
  const assigned = new Set<string>();
  const clusters: ArchiveItem[][] = [];

  for (const lens of discoverMemoryLenses(items, visits)) {
    const members = lens.memoryIds
      .map((id) => items.find((x) => x.id === id))
      .filter(Boolean) as ArchiveItem[];
    if (members.length < 2) continue;
    if (members.some((m) => assigned.has(m.id))) continue;
    expandCluster(members, items, assigned);
    clusters.push(members);
  }

  const remainder = items.filter((it) => !assigned.has(it.id));
  for (const seed of remainder) {
    if (assigned.has(seed.id)) continue;
    const pool = items.filter((it) => !assigned.has(it.id));
    const related = findRelatedArchiveItems(seed, pool, 10, STRONG_LINK);
    const members = [
      seed,
      ...related.map((r) => r.item).filter((it) => !assigned.has(it.id)),
    ];
    if (members.length < 2) continue;
    expandCluster(members, items, assigned);
    clusters.push(members);
  }

  const singles = items.filter((it) => !assigned.has(it.id));
  return { clusters, singles };
}

function slotGrid(count: number) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

export function computeMemorySpaceLayout(
  items: ArchiveItem[],
  visits: Record<string, number>,
): MemorySpaceLayout {
  if (!items.length) {
    return { nodes: [], lines: [], overflowChips: [], clusterMap: new Map() };
  }

  const { clusters, singles } = buildArchiveClusters(items, visits);
  const sortedClusters = [...clusters].sort((a, b) => b.length - a.length);
  const { cols, rows } = slotGrid(Math.max(sortedClusters.length, 1));

  const nodes: LayoutNode[] = [];
  const lines: LayoutLine[] = [];
  const overflowChips: OverflowChip[] = [];
  const clusterMap = new Map<string, string[]>();

  const slotW = 88 / cols;
  const slotH = singles.length ? 58 / rows : 72 / rows;
  const slotTop = 6;

  sortedClusters.forEach((members, ci) => {
    const col = ci % cols;
    const row = Math.floor(ci / cols);
    const slotCx = 6 + col * slotW + slotW / 2;
    const slotCy = slotTop + row * slotH + slotH / 2;

    const anchor = pickAnchor(members, visits);
    const others = members.filter((m) => m.id !== anchor.id);
    const sortedOthers = [...others].sort(
      (a, b) =>
        memorySimilarity(b, anchor, items) - memorySimilarity(a, anchor, items),
    );

    const visibleSatellites = sortedOthers.slice(0, MAX_SATELLITES);
    const overflow = sortedOthers.slice(MAX_SATELLITES);
    const allIds = [anchor.id, ...sortedOthers.map((m) => m.id)];
    clusterMap.set(anchor.id, allIds);
    visibleSatellites.forEach((s) => clusterMap.set(s.id, allIds));
    overflow.forEach((s) => clusterMap.set(s.id, allIds));

    nodes.push({
      id: anchor.id,
      item: anchor,
      x: slotCx,
      y: slotCy,
      role: "anchor",
      size: memoryBubbleSize(anchor, visits),
      clusterId: anchor.id,
    });

    const minR = 11;
    const maxR = Math.min(slotW, slotH) * 0.34;

    visibleSatellites.forEach((sat, si) => {
      const count = visibleSatellites.length;
      const angle = (si / count) * Math.PI * 2 - Math.PI / 2;
      const sim = memorySimilarity(sat, anchor, items);
      const norm = Math.min(
        1,
        Math.max(0, (sim - STRONG_LINK) / (1 - STRONG_LINK + 0.001)),
      );
      const radius = maxR - norm * (maxR - minR);
      const x = slotCx + Math.cos(angle) * radius;
      const y = slotCy + Math.sin(angle) * radius;

      nodes.push({
        id: sat.id,
        item: sat,
        x,
        y,
        role: "satellite",
        size: memoryBubbleSize(sat, visits),
        clusterId: anchor.id,
      });

      lines.push({ x1: slotCx, y1: slotCy, x2: x, y2: y });
    });

    if (overflow.length > 0) {
      overflowChips.push({
        clusterId: anchor.id,
        x: slotCx + maxR * 0.55,
        y: slotCy - maxR * 0.75,
        count: overflow.length,
        itemIds: overflow.map((m) => m.id),
      });
    }
  });

  if (singles.length) {
    const edgeY = slotTop + rows * slotH + 8;
    const edgeSpan = 88;
    singles.forEach((item, i) => {
      const t = singles.length === 1 ? 0.5 : i / (singles.length - 1);
      const x = 6 + t * edgeSpan;
      const y = edgeY + (i % 2) * 5;
      nodes.push({
        id: item.id,
        item,
        x,
        y: Math.min(y, 94),
        role: "single",
        size: "sm",
      });
    });
  }

  return { nodes, lines, overflowChips, clusterMap };
}

export function nodeDiameter(role: LayoutNode["role"], size: "sm" | "md" | "lg") {
  if (role === "anchor") {
    if (size === "lg") return 96;
    if (size === "md") return 88;
    return 80;
  }
  if (role === "single") {
    return size === "sm" ? 52 : 56;
  }
  if (size === "lg") return 72;
  if (size === "md") return 64;
  return 58;
}

export function MemorySpaceNode({
  node,
  onOpen,
}: {
  node: LayoutNode;
  onOpen: (item: ArchiveItem) => void;
}) {
  const title = archiveDisplayTitle(node.item.id, node.item);
  const d = nodeDiameter(node.role, node.size);

  const roleClass =
    node.role === "anchor"
      ? "archive-space-node-anchor font-semibold"
      : node.role === "satellite"
        ? "archive-space-node-satellite font-medium"
        : "archive-space-node-single font-medium";

  const textSize =
    node.role === "anchor"
      ? "text-[12px] leading-[1.35]"
      : node.role === "single"
        ? "text-[10px] leading-[1.3]"
        : "text-[11px] leading-[1.32]";

  return (
    <button
      type="button"
      onClick={() => onOpen(node.item)}
      className={`touch-press absolute flex items-center justify-center rounded-full text-center transition active:scale-[0.96] ${roleClass} ${textSize}`}
      style={{
        width: d,
        height: d,
        left: `calc(${node.x}% - ${d / 2}px)`,
        top: `calc(${node.y}% - ${d / 2}px)`,
      }}
    >
      <span className="line-clamp-2 px-2">{title}</span>
    </button>
  );
}
