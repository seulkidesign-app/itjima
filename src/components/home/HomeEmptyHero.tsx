import {
  ArrowDown,
  CalendarClock,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { useT } from "@/lib/i18n";

/** Compact first-run cue that demonstrates the product before the first input. */
export function HomeEmptyHero() {
  const t = useT();

  return (
    <section
      className="itjima-empty-hero flex flex-1 flex-col items-center justify-center px-4 pb-3 pt-[min(5dvh,2.5rem)] text-center"
      data-testid="home-empty-hero"
      aria-labelledby="home-empty-title"
    >
      <div className="itjima-empty-orb" aria-hidden>
        <span className="itjima-empty-orb-core">
          <MessageSquareText size={25} strokeWidth={1.9} />
        </span>
      </div>

      <p className="mt-4 font-display text-[11px] uppercase tracking-[0.17em] text-ink/38">
        {t("말하듯 남기는 일정", "Natural-language scheduling")}
      </p>
      <h1
        id="home-empty-title"
        className="mt-2 max-w-[21rem] text-[clamp(25px,6.8vw,34px)] font-black leading-[1.08] tracking-[-0.045em] text-ink"
      >
        {t("무엇을 잊고 싶지 않나요?", "What do you want to remember?")}
      </h1>
      <p className="mt-2 max-w-[21rem] text-[14px] leading-[1.6] text-ink-soft/95">
        {t(
          "대충 말해도 괜찮아요. 확실한 정보는 채우고, 필요한 것만 확인해요.",
          "Say it roughly. Itjima fills what is clear and asks only what matters.",
        )}
      </p>

      <div
        className="mt-5 w-full max-w-[22rem] rounded-[20px] border border-ink/[0.08] bg-white/72 px-3.5 py-3 text-left shadow-card"
        aria-label={t("일정 해석 예시", "Schedule interpretation example")}
      >
        <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <MessageSquareText size={15} aria-hidden />
          <span>{t("내일 3시 치과", "Dentist tomorrow at 3")}</span>
        </div>

        <div className="my-2 flex justify-center text-ink/25" aria-hidden>
          <ArrowDown size={15} />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-ink-soft" aria-hidden />
            <span className="text-[13px] font-bold text-ink">
              {t("내일 · 3시", "Tomorrow · 3:00")}
            </span>
            <span className="ml-auto rounded-full bg-primary/55 px-2 py-1 text-[10px] font-bold text-ink">
              {t("오전·오후 확인", "Confirm AM/PM")}
            </span>
          </div>
          <div className="flex items-center gap-2 border-t border-ink/[0.06] pt-2 text-[11px] text-ink-soft">
            <ShieldCheck size={14} aria-hidden />
            <span>{t("추정한 정보는 숨기지 않아요", "Assumptions are always visible")}</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11px] font-medium text-ink-soft/68">
        {t("아래 입력창에 바로 남겨보세요", "Start in the field below")}
      </p>
    </section>
  );
}
