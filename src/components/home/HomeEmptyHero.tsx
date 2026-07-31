import { useT } from "@/lib/i18n";

/** Calm Home opening for natural-language schedule capture. */
export function HomeEmptyHero() {
  const t = useT();

  return (
    <div
      className="flex flex-1 flex-col items-center justify-end px-4 pb-4 pt-[min(12dvh,5rem)]"
      data-testid="home-empty-hero"
    >
      <p className="font-display text-[13px] uppercase tracking-[0.14em] text-ink/35">
        {t("잊지마", "Itjima")}
      </p>
      <p className="mt-4 max-w-[18rem] text-center text-[17px] font-semibold leading-[1.45] tracking-[-0.02em] text-ink">
        {t(
          "말하듯 남기면 일정이 돼요.",
          "Say it naturally. Turn it into a schedule.",
        )}
      </p>
      <p className="mt-2 max-w-[18rem] text-center text-[14px] leading-relaxed text-ink-soft/90">
        {t(
          "확실한 건 채우고, 애매한 것만 확인해요.",
          "We fill in what's clear and ask only about the rest.",
        )}
      </p>
    </div>
  );
}
