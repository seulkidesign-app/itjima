import { motion } from "framer-motion";
import { useT } from "@/lib/i18n";
import { MOTION_SUCCESS, MOTION_THINKING } from "@/lib/motionLanguage";

type Props = {
  emoji?: string;
  titleKo: string;
  titleEn: string;
  hintKo: string;
  hintEn: string;
  variant?: "default" | "success";
};

export function EmptyState({
  emoji = "✍️",
  titleKo,
  titleEn,
  hintKo,
  hintEn,
  variant = "default",
}: Props) {
  const t = useT();
  const spring = variant === "success" ? MOTION_SUCCESS : MOTION_THINKING;

  return (
    <motion.div
      className="flex min-h-[44dvh] flex-col items-center justify-center px-7 text-center"
      role="status"
      initial={{ opacity: 0, y: variant === "success" ? 4 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
    >
      <motion.div
        className={
          variant === "success"
            ? "flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-primary/12"
            : "text-[3.25rem] leading-none"
        }
        aria-hidden
        initial={{ scale: variant === "success" ? 0.9 : 0.94, opacity: 0 }}
        animate={
          variant === "success"
            ? { scale: 1, opacity: 1 }
            : { scale: 1, opacity: 1, y: [0, -5, 0] }
        }
        transition={
          variant === "success"
            ? { ...spring, delay: 0.05 }
            : { duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.05 }
        }
      >
        <span className={variant === "success" ? "text-[1.65rem]" : ""}>
          {emoji}
        </span>
      </motion.div>
      <motion.p
        className={`mt-5 font-semibold tracking-[-0.025em] text-ink ${
          variant === "success" ? "text-[21px]" : "text-[18px]"
        }`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.1 }}
      >
        {t(titleKo, titleEn)}
      </motion.p>
      <motion.p
        className="mt-2.5 max-w-[300px] text-[14px] leading-[1.55] text-ink-soft/90"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.16 }}
      >
        {t(hintKo, hintEn)}
      </motion.p>
    </motion.div>
  );
}
