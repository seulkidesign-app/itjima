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
      className="flex min-h-[44dvh] flex-col items-center justify-center px-6 text-center"
      role="status"
      initial={{ opacity: 0, y: variant === "success" ? 6 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
    >
      <motion.div
        className={
          variant === "success"
            ? "flex h-16 w-16 items-center justify-center rounded-full bg-primary/15"
            : "text-5xl"
        }
        aria-hidden
        initial={{ scale: variant === "success" ? 0.88 : 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...spring, delay: 0.05 }}
      >
        <span className={variant === "success" ? "text-2xl" : ""}>{emoji}</span>
      </motion.div>
      <motion.p
        className={`mt-4 font-bold tracking-[-0.02em] text-ink ${
          variant === "success" ? "text-[20px]" : "text-[17px]"
        }`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.1 }}
      >
        {t(titleKo, titleEn)}
      </motion.p>
      <motion.p
        className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-ink-soft"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.16 }}
      >
        {t(hintKo, hintEn)}
      </motion.p>
    </motion.div>
  );
}
