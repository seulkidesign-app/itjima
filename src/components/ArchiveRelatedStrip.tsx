import { useT } from "@/lib/i18n";
import type { ArchiveItem } from "@/lib/store";
import { findRelatedArchiveItems } from "@/lib/archiveSearch";
import { STRONG_LINK } from "@/lib/memoryDiscovery";
import { archiveDisplayTitle } from "@/lib/archiveMeta";

type Props = {
  item: ArchiveItem;
  items: ArchiveItem[];
  onSelect: (item: ArchiveItem) => void;
};

export function ArchiveRelatedStrip({ item, items, onSelect }: Props) {
  const t = useT();
  const related = findRelatedArchiveItems(item, items, 4, STRONG_LINK);
  if (!related.length) return null;

  return (
    <div
      className="mt-3 rounded-[16px] bg-ink/[0.03] px-3 py-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[11px] font-medium text-ink-soft/70">
        {t("이어지는 기억", "Related here")}
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {related.map(({ item: rel }) => (
          <button
            key={rel.id}
            type="button"
            onClick={() => onSelect(rel)}
            className="touch-press rounded-[12px] px-2 py-2 text-left active:bg-ink/[0.04]"
          >
            <p className="line-clamp-1 text-[13px] font-semibold text-ink">
              {archiveDisplayTitle(rel.id, rel)}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-soft/75">
              {(rel.raw_text ?? rel.text).slice(0, 72)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
