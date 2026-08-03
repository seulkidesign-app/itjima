import { useMemo, useState } from "react";
import { Clock3, MessageCircleMore } from "lucide-react";
import { useLang, useT } from "@/lib/i18n";
import { buildMirrorDisplay } from "@/lib/nlMirrorCopy";
import { warmMirrorLine } from "@/lib/warmMirrorCopy";
import { shouldShowNlPrompt, understandNaturalLanguage } from "@/lib/nlSchedule";
import type { InboxItem } from "@/lib/store";
import { BrainMirrorReflectionBody } from "@/components/BrainMirrorReflection";

type Props = {
  item: InboxItem;
};

export function DeckCardContent({ item }: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";
  const [expanded, setExpanded] = useState(false);

  const nl = useMemo(
    () => understandNaturalLanguage(item.text, uiLang),
    [item.text, uiLang],
  );
  const mirror = useMemo(
    () => buildMirrorDisplay(item.text, nl, uiLang),
    [item.text, nl, uiLang],
  );
  const showNlMirror =
    shouldShowNlPrompt(item.text, uiLang) && nl.intent !== "keep";
  const legacyBm = item.brain_mirror;
  const text = item.text || t("사진만 있어요", "Photo only");
  const clamped = !expanded && text.split("\n").length > 6;

  return (
    <>
      <div className="deck-card-kicker flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-ink/38">
          <MessageCircleMore size={13} strokeWidth={2.2} aria-hidden />
          {t("방금 남긴 생각", "A thought you dropped")}
        </span>
        <span className="rounded-full border border-ink/[0.07] bg-white/70 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-ink/30">
          {t("한 장씩", "One by one")}
        </span>
      </div>

      {item.images?.length > 0 && (
        <div className="deck-card-images mb-4 mt-4 flex gap-2 overflow-x-auto">
          {item.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="h-20 w-20 rounded-[16px] object-cover shadow-card ring-1 ring-ink/8"
            />
          ))}
        </div>
      )}

      <div
        className="deck-card-thought mt-5 select-text"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p
          className={`whitespace-pre-wrap text-[23px] font-semibold leading-[1.48] tracking-[-0.03em] text-ink ${
            clamped ? "line-clamp-6" : ""
          }`}
        >
          {text}
        </p>
        {text.split("\n").length > 6 && !expanded && (
          <button
            type="button"
            className="mt-2 text-[13px] font-semibold text-ink-soft underline-offset-2 hover:underline"
            onClick={() => setExpanded(true)}
          >
            {t("전체 보기", "Show all")}
          </button>
        )}
      </div>

      {showNlMirror && (
        <div
          className="deck-mirror-panel mt-6 rounded-[18px] border border-ink/[0.07] bg-ink/[0.025] p-4"
          role="complementary"
          aria-label={t("Brain Mirror 해석", "Brain Mirror interpretation")}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-ink/35">
            <Clock3 size={13} strokeWidth={2.2} aria-hidden />
            {t("이렇게 기억할게요", "Here is what I understood")}
          </p>
          <p className="mt-2 text-[13px] font-medium leading-snug text-ink-soft">
            {warmMirrorLine(item.text, nl, uiLang)}
          </p>
          {mirror.when && (
            <p className="deck-mirror-when mt-2 text-[16px] font-bold tracking-[-0.018em] text-ink">
              {mirror.when}
            </p>
          )}
        </div>
      )}

      {!showNlMirror && legacyBm?.title && legacyBm.items.length > 0 && (
        <div
          className="deck-mirror-panel mt-6 rounded-[18px] border border-ink/[0.07] bg-ink/[0.025] p-4"
          role="complementary"
          aria-label={t("다시 이해하기", "Understand again")}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <BrainMirrorReflectionBody
            result={legacyBm}
            showDateHint={Boolean(legacyBm.suggestedDateText?.trim())}
            dateLabel={legacyBm.suggestedDateText?.trim() || null}
          />
        </div>
      )}
    </>
  );
}
