import { motion } from "framer-motion";
import { useT } from "@/lib/i18n";
import { tap as tapHaptic } from "@/lib/haptics";
import { trackSwipeTutorialDismissed } from "@/lib/swipeAnalytics";
import { markSwipeTutorialDone } from "@/lib/swipeTutorial";
import { TRANSITION_CALM } from "@/lib/motion";

type Props = {
  onDismiss: () => void;
};

export function SwipeTutorial({ onDismiss }: Props) {
  const t = useT();

  const dismiss = () => {
    tapHaptic();
    markSwipeTutorialDone();
    trackSwipeTutorialDismissed();
    onDismiss();
  };

  return (
    <motion.div
      className="absolute inset-x-0 bottom-[calc(100%+12px)] z-20 mx-auto w-full max-w-[340px] rounded-[var(--radius-md)] border border-ink/8 bg-white/98 px-4 py-4 shadow-float"
      data-testid="swipe-tutorial"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION_CALM}
    >
      <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {t("밀어서 마음을 정리해 보세요", "Swipe to clear your mind")}
      </p>

      <div className="relative mx-auto mt-4 h-10 max-w-[220px]">
        <motion.span
          className="absolute left-0 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-ink-soft/70"
          animate={{ x: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {t("← 보관", "← Vault")}
        </motion.span>
        <motion.span
          className="absolute right-0 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-ink-soft/70"
          animate={{ x: [0, 6, 0], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.4,
          }}
        >
          {t("일정 →", "Schedule →")}
        </motion.span>
        <motion.span
          className="absolute left-1/2 top-0 -translate-x-1/2 text-[11px] font-medium text-ink-soft/60"
          animate={{ y: [0, 5, 0], opacity: [0.45, 0.95, 0.45] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.8,
          }}
        >
          ↓
        </motion.span>
      </div>

      <p className="mt-2 text-center text-[12px] text-ink-soft/75">
        {t("아래로 내리면 그대로 둘 수 있어요", "Down to keep it here")}
      </p>
      <button
        type="button"
        className="mt-3 w-full rounded-full bg-ink/[0.05] py-2.5 text-[13px] font-semibold text-ink transition-transform active:scale-[0.98]"
        onClick={dismiss}
      >
        {t("알겠어요", "Got it")}
      </button>
    </motion.div>
  );
}
