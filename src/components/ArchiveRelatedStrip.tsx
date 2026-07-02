import { useT } from "@/lib/i18n";
import type { ArchiveItem } from "@/lib/store";
import { findRelatedArchiveItems } from "@/lib/archiveSearch";
import { archiveDisplayTitle } from "@/lib/archiveMeta";

type Props = {
  item: ArchiveItem;
  items: ArchiveItem[];
  onSelect: (item: ArchiveItem) => void;
};

export function ArchiveRelatedStrip({ item, items, onSelect }: Props) {
  const t = useT();
  const related = findRelatedArchiveItems(item, items, 4);
  if (!related.length) return null;

  return (
    <div
      className="mt-3 rounded-[18px] bg-ink/[0.04] px-3 py-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
        {t("관련 생각", "Related thoughts")}
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {related.map(({ item: rel, score }) => (
          <button
            key={rel.id}
            type="button"
            onClick={() => onSelect(rel)}
            className="touch-press rounded-[14px] bg-white/80 px-3 py-2 text-left"
          >
            <p className="line-clamp-1 text-[13px] font-semibold text-ink">
              {archiveDisplayTitle(rel.id, rel)}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-soft">
              {(rel.raw_text ?? rel.text).slice(0, 60)}
            </p>
            <span className="mt-1 inline-block text-[10px] font-bold text-primary">
              {Math.round(score * 100)}% {t("유사", "match")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
