import { motion } from "framer-motion";
import type { ThinkingInsight } from "@/lib/thinkingInsights";
import { useT, useLang } from "@/lib/i18n";

type Props = {
  insights: ThinkingInsight[];
  onRevisit?: (memoryId: string) => void;
};

export function ThinkingInsightsSection({ insights, onRevisit }: Props) {
  const t = useT();
  const { lang } = useLang();

  if (!insights.length) return null;

  return (
    <section className="space-y-2.5">
      <p className="px-1 text-[12px] font-medium text-ink-soft/70">
        {t("나를 돌아보며", "About your thinking")}
      </p>
      <div className="space-y-2">
        {insights.map((insight, i) => {
          const message =
            lang === "en" ? insight.messageEn : insight.messageKo;
          const sampleId = insight.memoryIds[0];

          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                ease: [0.32, 0.72, 0, 1],
                delay: i * 0.04,
              }}
              className="rounded-[18px] bg-ink/[0.025] px-4 py-3.5 ring-1 ring-ink/[0.03]"
            >
              <p className="text-[14px] leading-[1.55] text-ink/88">
                {message}
              </p>
              {sampleId && onRevisit && (
                <button
                  type="button"
                  onClick={() => onRevisit(sampleId)}
                  className="touch-press mt-2.5 text-[12px] font-medium text-ink-soft/75 active:text-ink"
                >
                  {t("떠올려보기 →", "Revisit →")}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
