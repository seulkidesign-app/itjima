import { CalendarClock, Check, MessageSquareText, ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Launch-ready Home opening for natural-language schedule capture. */
export function HomeEmptyHero() {
  const t = useT();

  return (
    <section
      className="itjima-empty-hero flex flex-1 flex-col items-center justify-center px-4 pb-5 pt-[min(9dvh,4.5rem)] text-center"
      data-testid="home-empty-hero"
      aria-labelledby="home-empty-title"
    >
      <div className="itjima-empty-orb" aria-hidden>
        <span className="itjima-empty-orb-core">
          <MessageSquareText size={27} strokeWidth={1.9} />
        </span>
      </div>

      <p className="mt-6 font-display text-[12px] uppercase tracking-[0.18em] text-ink/38">
        {t("자연어 일정 캡처", "Natural-language scheduling")}
      </p>
      <h1
        id="home-empty-title"
        className="mt-3 max-w-[20rem] text-[clamp(26px,7vw,34px)] font-black leading-[1.08] tracking-[-0.045em] text-ink"
      >
        {t("말하듯 남기면, 일정이 됩니다.", "Say the plan. It becomes a schedule.")}
      </h1>
      <p className="mt-3 max-w-[20rem] text-[14px] leading-[1.65] text-ink-soft/95">
        {t(
          "확실한 날짜와 시간은 채우고, 위험한 추측이 필요한 부분만 확인해요.",
          "Itjima fills what is clear and asks only when a date or time needs confirmation.",
        )}
      </p>

      <div className="mt-7 grid w-full max-w-[22rem] gap-2.5 text-left" role="list">
        <div className="itjima-empty-proof" role="listitem">
          <span className="itjima-empty-proof-icon">
            <CalendarClock size={17} aria-hidden />
          </span>
          <span>
            <strong>{t("일정 자동 해석", "Understands schedules")}</strong>
            <small>{t("날짜·시간·할 일을 분리", "Separates date, time, and task")}</small>
          </span>
          <Check size={15} className="ml-auto text-emerald-600" aria-hidden />
        </div>
        <div className="itjima-empty-proof" role="listitem">
          <span className="itjima-empty-proof-icon">
            <ShieldCheck size={17} aria-hidden />
          </span>
          <span>
            <strong>{t("애매함은 확인", "Confirms ambiguity")}</strong>
            <small>{t("오전·오후와 날짜를 단정하지 않음", "Never silently guesses AM, PM, or day")}</small>
          </span>
          <Check size={15} className="ml-auto text-emerald-600" aria-hidden />
        </div>
      </div>

      <p className="mt-6 text-[11px] font-medium text-ink-soft/70">
        {t(
          "예: ‘내일 오후 3시에 치과’",
          "Try: “Dentist tomorrow at 3 PM”",
        )}
      </p>
    </section>
  );
}
