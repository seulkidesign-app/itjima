import { motion, useReducedMotion } from "framer-motion";
import { useT } from "@/lib/i18n";
import { MOTION_CALM, MOTION_CALM_SLOW } from "@/lib/motionLanguage";

type Props = {
  emoji?: string;
  titleKo: string;
  titleEn: string;
  hintKo: string;
  hintEn: string;
  variant?: "default" | "success";
};

export function EmptyState({
  emoji,
  titleKo,
  titleEn,
  hintKo,
  hintEn,
  variant = "default",
}: Props) {
  const t = useT();
  const reduced = useReducedMotion();
  const transition = variant === "success" ? MOTION_CALM_SLOW : MOTION_CALM;
  const showEmoji = Boolean(emoji);
  const enter = reduced
    ? { opacity: 0 }
    : { opacity: 0, y: 8 };
  const settled = reduced
    ? { opacity: 1 }
    : { opacity: 1, y: 0 };

  return (
    <motion.div
      className="flex min-h-[36dvh] flex-col items-center justify-center px-8 text-center"
      role="status"
      initial={enter}
      animate={settled}
      transition={transition}
    >
      {showEmoji && (
        <motion.div
          className={
            variant === "success"
              ? "flex h-16 w-16 items-center justify-center rounded-full bg-primary/12"
              : "text-[2.75rem] leading-none opacity-90"
          }
          aria-hidden
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={{ ...transition, delay: reduced ? 0 : 0.024 }}
        >
          <span className={variant === "success" ? "text-[1.5rem]" : ""}>
            {emoji}
          </span>
        </motion.div>
      )}
      <motion.p
        className={`${showEmoji ? "mt-4" : ""} text-[19px] font-semibold tracking-[-0.025em] text-ink`}
        initial={enter}
        animate={settled}
        transition={{ ...transition, delay: reduced ? 0 : 0.048 }}
      >
        {t(titleKo, titleEn)}
      </motion.p>
      <motion.p
        className="mt-2 max-w-[280px] text-secondary leading-relaxed"
        initial={enter}
        animate={settled}
        transition={{ ...transition, delay: reduced ? 0 : 0.072 }}
      >
        {t(hintKo, hintEn)}
      </motion.p>
    </motion.div>
  );
}
