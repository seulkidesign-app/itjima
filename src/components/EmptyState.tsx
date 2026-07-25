import { motion } from "framer-motion";
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
  const transition = variant === "success" ? MOTION_CALM_SLOW : MOTION_CALM;
  const showEmoji = Boolean(emoji);

  return (
    <motion.div
      className="flex min-h-[36dvh] flex-col items-center justify-center px-7 text-center"
      role="status"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
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
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...transition, delay: 0.04 }}
        >
          <span className={variant === "success" ? "text-[1.5rem]" : ""}>
            {emoji}
          </span>
        </motion.div>
      )}
      <motion.p
        className={`${showEmoji ? "mt-4" : ""} text-[18px] font-semibold tracking-[-0.02em] text-ink`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: 0.08 }}
      >
        {t(titleKo, titleEn)}
      </motion.p>
      <motion.p
        className="mt-2 max-w-[280px] text-secondary leading-relaxed"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: 0.12 }}
      >
        {t(hintKo, hintEn)}
      </motion.p>
    </motion.div>
  );
}
