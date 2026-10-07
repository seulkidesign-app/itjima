import { useT } from "@/lib/i18n";

/** V03 empty Capture home — communicate the full Capture → Resurface promise. */
export function HomeEmptyHero() {
  const t = useT();

  return (
    <section
      className="itjima-empty-hero flex flex-1 flex-col items-start justify-start px-6 pb-3 pt-10 text-left"
      data-testid="home-empty-hero"
      aria-labelledby="home-empty-title"
    >
      <div className="mb-5 inline-flex -rotate-1 items-center rounded-[18px] bg-[#FFF3A8] px-4 py-3 shadow-card ring-1 ring-ink/[0.04]">
        <span className="text-[13px] font-bold tracking-[-0.01em] text-ink/70">
          &gt;ij&lt;
        </span>
      </div>
      <h1 id="home-empty-title" className="quietly-hero-title max-w-[19rem]">
        {t("생각나는 건 그냥 남겨두세요.", "Drop whatever is on your mind.")}
      </h1>
      <p className="quietly-hero-sub mt-3 max-w-[20rem]">
        {t(
          "일정인지 메모인지 정리하지 않아도 돼요. 필요한 순간에 다시 꺼내드릴게요.",
          "No need to organize it first. It can come back when it matters.",
        )}
      </p>
      <div className="mt-7 flex items-center gap-2 text-[12px] font-semibold text-ink-soft/70">
        <span className="rounded-full bg-ink/[0.045] px-3 py-2">
          {t("남기기", "Capture")}
        </span>
        <span aria-hidden>→</span>
        <span className="rounded-full bg-ink/[0.045] px-3 py-2">
          {t("잊기", "Forget")}
        </span>
        <span aria-hidden>→</span>
        <span className="rounded-full bg-[#FFF3A8] px-3 py-2 text-ink/75">
          {t("다시 발견", "Resurface")}
        </span>
      </div>
    </section>
  );
}
