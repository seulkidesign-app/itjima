import { useMemo, useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import { buildMirrorDisplay } from "@/lib/nlMirrorCopy";
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
      {item.images?.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
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
        className="select-text"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p
          className={`whitespace-pre-wrap text-[21px] font-semibold leading-[1.55] tracking-[-0.02em] text-ink ${
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
          className="mt-5 border-t border-ink/[0.07] pt-4"
          role="complementary"
          aria-label={t("Brain Mirror 해석", "Brain Mirror interpretation")}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="text-[12px] font-semibold text-ink-soft">
            {nl.intent === "schedule_exact" || nl.intent === "schedule_clarify"
              ? t("🧠 일정으로 이해했어요", "🧠 Understood as schedule")
              : nl.intent === "task"
                ? t("🧠 할 일로 이해했어요", "🧠 Understood as task")
                : nl.intent === "archive"
                  ? t("🧠 보관할 내용 같아요", "🧠 Looks like vault material")
                  : t("🧠 이렇게 이해했어요", "🧠 Here's what I understood")}
          </p>
          {mirror.when && (
            <p className="mt-1 text-[15px] font-medium text-ink">{mirror.when}</p>
          )}
          {!mirror.when && mirror.title && nl.intent !== "archive" && (
            <p className="mt-1 text-[14px] text-ink-soft">{mirror.title}</p>
          )}
        </div>
      )}

      {!showNlMirror && legacyBm?.title && legacyBm.items.length > 0 && (
        <div
          className="mt-5 border-t border-ink/[0.07] pt-4"
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
