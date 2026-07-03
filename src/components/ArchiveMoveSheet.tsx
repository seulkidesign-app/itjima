import { useT, useLang } from "@/lib/i18n";

type Group = {
  key: string;
  ko: string;
  en: string;
  emoji: string;
};

type Props = {
  open: boolean;
  groups: Group[];
  count: number;
  onClose: () => void;
  onPick: (key: string) => void;
};

export function ArchiveMoveSheet({
  open,
  groups,
  count,
  onClose,
  onPick,
}: Props) {
  const t = useT();
  const { lang } = useLang();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative w-full max-w-sm animate-slide-up rounded-t-[28px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/10" />
        <h2 className="text-[17px] font-semibold text-ink">
          {t("어디에 둘까요?", "Move to…")}
        </h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          {t(
            `${count}개의 기억`,
            count === 1 ? "1 memory" : `${count} memories`,
          )}
        </p>
        <ul className="mt-4 max-h-[50vh] space-y-1.5 overflow-y-auto">
          {groups.map((g) => (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => {
                  onPick(g.key);
                  onClose();
                }}
                className="touch-press flex w-full items-center gap-3 rounded-[18px] bg-ink/[0.04] px-4 py-3.5 text-left text-[15px] font-medium text-ink active:bg-ink/[0.07]"
              >
                <span className="text-lg">{g.emoji}</span>
                {lang === "en" ? g.en : g.ko}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="touch-press mt-4 w-full rounded-full py-3 text-[14px] font-semibold text-ink-soft"
        >
          {t("취소", "Cancel")}
        </button>
      </div>
    </div>
  );
}
