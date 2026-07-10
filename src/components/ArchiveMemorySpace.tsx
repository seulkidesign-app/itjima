import { useMemo } from "react";
import type { ArchiveItem } from "@/lib/store";
import { useT, useLang } from "@/lib/i18n";

type Props = {
  items: ArchiveItem[];
  selectedMonth: string | null;
  onSelectMonth: (key: string | null) => void;
};

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ArchiveTimelineStrip({
  items,
  selectedMonth,
  onSelectMonth,
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

  return (
    <div className="px-5 pb-2">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft/70">
        {t("시간", "Timeline")}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onSelectMonth(null)}
          className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
            selectedMonth === null
              ? "bg-ink text-white"
              : "bg-ink/[0.05] text-ink-soft"
          }`}
        >
          {t("전체", "All")}
        </button>
        {months.map(([key, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelectMonth(key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
              selectedMonth === key
                ? "bg-primary text-ink shadow-card"
                : "bg-ink/[0.05] text-ink-soft"
            }`}
          >
            {key}
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
