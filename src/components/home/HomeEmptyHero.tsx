import { useT } from "@/lib/i18n";

/** Layer 4 — calm Home opening when inbox is empty. */
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
      <p className="mt-4 max-w-[17rem] text-center text-[17px] font-semibold leading-[1.45] tracking-[-0.02em] text-ink">
        {t("떠오르면 여기 내려놓으세요.", "When it comes up, set it down here.")}
      </p>
      <p className="mt-2 max-w-[17rem] text-center text-[14px] leading-relaxed text-ink-soft/90">
        {t(
          "정리는 나중에 해도 괜찮아요.",
          "Sorting can wait.",
        )}
      </p>
    </div>
  );
}
