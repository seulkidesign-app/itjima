import { useEffect } from "react";
import { motion } from "framer-motion";
import { useLang, useT } from "@/lib/i18n";
import { haptic as hapticPulse, tap as tapHaptic } from "@/lib/haptics";
import {
  deckCompletionSubtitle,
  deckCompletionTitle,
  type SessionCounts,
} from "@/lib/deckCompletionCopy";
import { MOTION_SUCCESS } from "@/lib/motionLanguage";

type Props = {
  counts: SessionCounts;
  onClose: () => void;
};

export function DeckCompletion({ counts, onClose }: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";
  const title = deckCompletionTitle(counts, uiLang);
  const subtitle = deckCompletionSubtitle(counts, uiLang);
  const summary = t(
    `일정 ${counts.today} · 보관 ${counts.archive} · 그대로 ${counts.later}`,
    `Schedule ${counts.today} · Vault ${counts.archive} · Kept ${counts.later}`,
  );

  useEffect(() => {
    hapticPulse(12);
  }, []);

  return (
    <motion.div
      data-testid="decision-deck-complete"
      className="w-full max-w-[320px] px-4 pb-2 text-center"
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={MOTION_SUCCESS}
    >
      <motion.div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/14"
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: [0.88, 1.04, 1] }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        aria-hidden
      >
        <span className="text-[1.65rem] leading-none">🧠</span>
      </motion.div>

      <motion.p
        className="text-[22px] font-bold tracking-[-0.03em] text-ink"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, ...MOTION_SUCCESS }}
      >
        {title}
      </motion.p>

      {subtitle && (
        <motion.p
          className="mt-2 text-[14px] font-medium text-ink-soft/90"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22, duration: 0.24 }}
        >
          {subtitle}
        </motion.p>
      )}

      <motion.p
        className="mt-4 text-[15px] font-medium tabular-nums text-ink-soft"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38, duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {summary}
      </motion.p>

      <motion.button
        type="button"
        className="pill-yellow mt-7 min-h-[48px] w-full px-6 py-3 text-[14px] font-bold text-ink"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.28 }}
        onClick={() => {
          tapHaptic();
          onClose();
        }}
      >
        {t("홈으로", "Back home")}
      </motion.button>
    </motion.div>
  );
}
