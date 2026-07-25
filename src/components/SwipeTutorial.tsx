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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION_CALM}
    >
      <p className="text-[15px] font-semibold text-ink">
        {t("밀어서 생각을 정리해보세요", "Swipe to sort your thoughts")}
      </p>
      <p className="mt-2 text-center text-[13px] font-medium text-ink-soft">
        {t("← 보관", "← Vault")}{" "}
        <span className="text-ink/30">·</span>{" "}
        {t("일정 →", "Schedule →")}
      </p>
      <p className="mt-1.5 text-center text-[12px] text-ink-soft/80">
        {t(
          "아래로 내리면 그대로 둘 수 있어요.",
          "Swipe down to keep it here for now.",
        )}
      </p>
      <button
        type="button"
        className="mt-3 w-full rounded-full bg-ink/[0.05] py-2.5 text-[13px] font-semibold text-ink"
        onClick={dismiss}
      >
        {t("알겠어요", "Got it")}
      </button>
    </motion.div>
  );
}
