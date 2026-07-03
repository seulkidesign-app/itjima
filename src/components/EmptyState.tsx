import { motion } from "framer-motion";
import { useT } from "@/lib/i18n";
import { SPRING_DEFAULT } from "@/lib/motion";

type Props = {
  emoji: string;
  titleKo: string;
  titleEn: string;
  hintKo: string;
  hintEn: string;
};

export function EmptyState({ emoji, titleKo, titleEn, hintKo, hintEn }: Props) {
  const t = useT();
  return (
    <motion.div
      className="flex min-h-[44dvh] flex-col items-center justify-center px-6 text-center"
      role="status"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_DEFAULT, duration: 0.4 }}
    >
      <motion.div
        className="text-5xl"
        aria-hidden
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...SPRING_DEFAULT, delay: 0.06 }}
      >
        {emoji}
      </motion.div>
      <motion.p
        className="mt-4 text-[17px] font-bold tracking-[-0.02em] text-ink"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_DEFAULT, delay: 0.12 }}
      >
        {t(titleKo, titleEn)}
      </motion.p>
      <motion.p
        className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-ink-soft"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_DEFAULT, delay: 0.18 }}
      >
        {t(hintKo, hintEn)}
      </motion.p>
    </motion.div>
  );
}
