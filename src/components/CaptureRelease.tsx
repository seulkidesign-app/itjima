import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, CalendarClock, Check, Clock3 } from "lucide-react";
import type { InboxItem } from "@/lib/store";
import { calmSuggestionReason, suggestResurfaceTime } from "@/lib/dateDetect";
import { buildCalmInterpretation } from "@/lib/mirrorSentence";
import { useLang, useT } from "@/lib/i18n";
import { confirm as confirmHaptic, tap } from "@/lib/haptics";
import { EASE_OUT_APP } from "@/lib/motion";

type Props = {
  item: InboxItem;
  pendingSchedule?: boolean;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onSchedule: (item: InboxItem) => void;
  onConfirmSuggested: (
    item: InboxItem,
    start: Date,
    end: Date,
  ) => void | Promise<void>;
  onComplete: () => void;
  /** Centered when inbox is empty; overlay when the list already exists. */
  variant?: "hero" | "overlay";
};

function formatMoment(date: Date, lang: "ko" | "en") {
  return date.toLocaleString(lang === "en" ? "en-US" : "ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CaptureRelease({
  item,
  pendingSchedule = false,
  onArchive,
  onSchedule,
  onConfirmSuggested,
  onComplete,
  variant = "overlay",
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en" : "ko";
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState<"schedule" | "archive" | null>(null);

  const suggestion = useMemo(
    () => suggestResurfaceTime(item.text),
    [item.text],
  );
  const interpretation = useMemo(
    () => buildCalmInterpretation(item.text, locale),
    [item.text, locale],
  );
  const suggestionReason = useMemo(() => {
    if (suggestion.source === "detected") {
      return calmSuggestionReason(item.text, locale);
    }
    return t(
      "날짜가 없어서 내일 아침을 제안했어요. 언제든 바꿀 수 있어요.",
      "There was no date, so tomorrow morning is a gentle default. You can change it.",
    );
  }, [item.text, locale, suggestion.source, t]);

  useEffect(() => {
    setReady(false);
    setSaving(null);
    const id = window.setTimeout(() => setReady(true), 220);
    return () => window.clearTimeout(id);
  }, [item.id]);

  const busy = pendingSchedule || saving !== null;
  const shellClass =
    variant === "hero"
      ? "relative z-10 flex min-h-0 flex-1 items-center justify-center px-5 pb-8"
      : "pointer-events-auto fixed inset-0 z-[45] flex items-center justify-center px-5 pb-[112px] pt-16";

  const confirmSuggested = async () => {
    if (busy) return;
    setSaving("schedule");
    confirmHaptic();
    try {
      await onConfirmSuggested(item, suggestion.start, suggestion.end);
    } finally {
      setSaving(null);
    }
  };

  const archiveOnly = async () => {
    if (busy) return;
    setSaving("archive");
    tap();
    try {
      await onArchive(item);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      className={shellClass}
      role={variant === "overlay" ? "dialog" : undefined}
      aria-modal={variant === "overlay" ? true : undefined}
      aria-label={t("다시 꺼낼 시점 정하기", "Choose when to bring it back")}
    >
      {variant === "overlay" && (
        <motion.button
          type="button"
          aria-label={t("나중에 정하기", "Decide later")}
          className="absolute inset-0 bg-white/55 backdrop-blur-[5px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.32, ease: EASE_OUT_APP }}
          onClick={() => {
            if (!busy) onComplete();
          }}
        />
      )}

      <motion.section
        className="relative z-[1] w-full max-w-[340px] overflow-hidden rounded-[30px] border border-ink/[0.06] bg-white shadow-[0_18px_60px_-22px_rgba(0,0,0,0.24)]"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.46, ease: EASE_OUT_APP }}
      >
        <div className="px-5 pb-5 pt-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.04em] text-ink-soft">
            <Check size={14} className="text-ink" strokeWidth={2.5} />
            {t("안전하게 맡아뒀어요", "Saved safely")}
          </div>

          <p className="mt-3 whitespace-pre-wrap text-[18px] font-semibold leading-[1.55] tracking-[-0.02em] text-ink">
            {item.text ||
              t("이미지로 남긴 생각", "A thought saved as an image")}
          </p>

          <AnimatePresence>
            {ready && interpretation && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 text-[13px] leading-[1.65] text-ink-soft/75"
              >
                {interpretation}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-ink/[0.06] bg-ink/[0.018] px-4 pb-4 pt-4">
          <div className="px-1">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
              <Clock3 size={14} />
              {t("추천 시점", "Suggested moment")}
            </div>
            <p className="mt-1 text-[17px] font-bold tracking-[-0.02em] text-ink">
              {formatMoment(suggestion.start, locale)}
            </p>
            {suggestionReason && (
              <p className="mt-1.5 text-[12px] leading-[1.55] text-ink-soft/75">
                {suggestionReason}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void confirmSuggested()}
            className="touch-press mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[15px] font-bold text-ink shadow-[0_5px_18px_-8px_rgba(0,0,0,0.22)] disabled:opacity-50"
          >
            <CalendarClock size={18} strokeWidth={2.25} />
            {saving === "schedule"
              ? t("맡기는 중…", "Saving…")
              : t("이때 다시 꺼내기", "Bring it back then")}
          </button>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                tap();
                onSchedule(item);
              }}
              className="touch-press min-h-11 rounded-full border border-ink/[0.08] bg-white px-3 text-[13px] font-semibold text-ink disabled:opacity-50"
            >
              {t("시점 바꾸기", "Change time")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void archiveOnly()}
              className="touch-press flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-ink/[0.08] bg-white px-3 text-[13px] font-semibold text-ink disabled:opacity-50"
            >
              <Archive size={15} />
              {saving === "archive"
                ? t("보관 중…", "Archiving…")
                : t("보관만 하기", "Archive only")}
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onComplete}
            className="touch-press mt-2 min-h-11 w-full text-[12px] font-medium text-ink-soft/75 disabled:opacity-50"
          >
            {t(
              "일단 맡겨두고 나중에 정할게요",
              "Keep it here and decide later",
            )}
          </button>
        </div>
      </motion.section>
    </div>
  );
}
