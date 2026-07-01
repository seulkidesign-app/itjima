import { useT, useLang } from "@/lib/i18n";
import type { ArchiveItem } from "@/lib/store";
import { archiveGroup } from "@/lib/dateDetect";

export type OrganizeMove = {
  id: string;
  preview: string;
  fromLabel: string;
  toLabel: string;
  toKey: string;
};

type Props = {
  open: boolean;
  items: ArchiveItem[];
  overrides: Record<string, string>;
  customGroupKeys: Set<string>;
  allGroups: { key: string; ko: string; en: string; emoji: string }[];
  onClose: () => void;
  onApply: (nextOverrides: Record<string, string>) => void;
};

export function ArchiveOrganizeSheet({
  open,
  items,
  overrides,
  customGroupKeys,
  allGroups,
  onClose,
  onApply,
}: Props) {
  const t = useT();
  const { lang } = useLang();

  if (!open) return null;

  const labelOf = (key: string) => {
    const g = allGroups.find((x) => x.key === key);
    if (!g) return key;
    return lang === "en" ? g.en : g.ko;
  };

  const moves: OrganizeMove[] = [];
  for (const it of items) {
    const cur = overrides[it.id];
    if (!cur || customGroupKeys.has(cur)) continue;
    const suggested = archiveGroup(it.text).key;
    moves.push({
      id: it.id,
      preview: (it.raw_text ?? it.text).slice(0, 48),
      fromLabel: labelOf(cur),
      toLabel: labelOf(suggested),
      toKey: suggested,
    });
  }

  const apply = () => {
    const next: Record<string, string> = {};
    Object.entries(overrides).forEach(([id, k]) => {
      if (customGroupKeys.has(k)) next[id] = k;
    });
    onApply(next);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 bg-ink/40 backdrop-blur-[2px] animate-fade-in" />
      <div
        className="animate-slide-up max-h-[75vh] overflow-y-auto rounded-t-[28px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/15" />
        <h2 className="text-[17px] font-bold text-ink">{t("그룹 제안", "Group suggestions")}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {t(
            "키워드로 다시 나눠요. 직접 만든 그룹은 그대로 둡니다. 적용 전에 확인해 주세요.",
            "Re-sort by keywords. Custom groups stay. Review before applying.",
          )}
        </p>
        {moves.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink-soft">
            {t("바꿀 그룹이 없어요.", "Nothing to change.")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {moves.slice(0, 8).map((m) => (
              <li key={m.id} className="rounded-[16px] bg-white px-3 py-2.5 text-[13px] shadow-card">
                <p className="truncate font-medium text-ink">{m.preview}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">
                  {m.fromLabel} → {m.toLabel}
                </p>
              </li>
            ))}
            {moves.length > 8 && (
              <p className="text-center text-[11px] text-ink-soft">
                +{moves.length - 8} {t("더", "more")}
              </p>
            )}
          </ul>
        )}
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-full bg-white/70 py-3.5 text-[15px] font-semibold text-ink">
            {t("취소", "Cancel")}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={moves.length === 0}
            className="flex-1 rounded-full bg-ink py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
          >
            {t("적용하기", "Apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
