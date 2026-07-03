import { useT } from "@/lib/i18n";

type Props = {
  emoji: string;
  titleKo: string;
  titleEn: string;
  hintKo: string;
  hintEn: string;
};

export function EmptyState({ emoji, titleKo, titleEn, hintKo, hintEn }: Props) {
  const t = useT();
  return (
    <div
      className="flex min-h-[44dvh] flex-col items-center justify-center px-6 text-center animate-fade-in"
      role="status"
    >
      <div className="text-5xl" aria-hidden>
        {emoji}
      </div>
      <p className="mt-4 text-[17px] font-bold text-ink">
        {t(titleKo, titleEn)}
      </p>
      <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-ink-soft">
        {t(hintKo, hintEn)}
      </p>
    </div>
  );
}
