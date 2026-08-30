import { Clock3 } from "lucide-react";
import type { HomeRediscoveryCandidate } from "@/lib/homeRediscovery";
import { useT } from "@/lib/i18n";

type Props = {
  candidate: HomeRediscoveryCandidate;
  onOpen: () => void;
  onKeep: () => void;
};

export function HomeRediscoveryCard({ candidate, onOpen, onKeep }: Props) {
  const t = useT();
  const { item, ageDays, reason } = candidate;
  const ageLabel =
    ageDays <= 1
      ? t("며칠 전 남긴 기록", "A record from a little while ago")
      : t(`${ageDays}일 전에 남긴 기록`, `Left ${ageDays} days ago`);

  return (
    <section
      data-testid="home-rediscovery-card"
      className="quietly-feedback-card px-4 py-4"
      aria-label={t("다시 꺼낸 기록", "Resurfaced record")}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
        <Clock3 size={14} strokeWidth={2} aria-hidden />
        <span>{t("다시 꺼내봤어요", "Brought this back")}</span>
      </div>

      <button
        type="button"
        data-testid="home-rediscovery-open"
        onClick={onOpen}
        className="touch-press mt-3 w-full text-left"
      >
        <p className="line-clamp-3 text-[16px] font-semibold leading-[1.5] tracking-[-0.01em] text-ink">
          {item.raw_text?.trim() || item.text.trim()}
        </p>
        <p className="mt-1.5 text-[11px] text-ink-soft/75">
          {ageLabel}
          {reason === "volume"
            ? t(" · 기록이 쌓여서 다시 꺼냈어요", " · brought back as records piled up")
            : ""}
        </p>
      </button>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="touch-press min-h-10 rounded-full bg-primary px-4 text-[12px] font-bold text-ink"
        >
          {t("열어보기", "Open")}
        </button>
        <button
          type="button"
          data-testid="home-rediscovery-keep"
          onClick={onKeep}
          className="touch-press min-h-10 rounded-full px-3 text-[12px] font-semibold text-ink-soft"
        >
          {t("계속 두기", "Keep here")}
        </button>
      </div>
    </section>
  );
}
