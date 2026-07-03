import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useT, useLang } from "@/lib/i18n";
import type { RevivalHint } from "@/lib/memoryRevival";
import { formatRevivalAge } from "@/lib/memoryRevival";
import { SPRING_DEFAULT } from "@/lib/motion";

type Props = {
  hint: RevivalHint;
  delayMs?: number;
  compact?: boolean;
  onRevisit: (memoryId: string) => void;
  onDismiss: () => void;
};

export function MemoryRevivalHint({
  hint,
  delayMs = 850,
  compact,
  onRevisit,
  onDismiss,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const [visible, setVisible] = useState(delayMs <= 0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (delayMs <= 0) return;
    const id = window.setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);

  const message = lang === "en" ? hint.messageEn : hint.messageKo;
  const primary = hint.matches.find((m) => m.id === hint.primaryId) ?? hint.matches[0];
  const more = hint.matches.filter((m) => m.id !== primary?.id);

  if (!visible || !primary) return null;

  return (
    <motion.div
      role="complementary"
      aria-label={t("이전 기억", "Past memory")}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
      className={`${compact ? "mt-2.5 border-t border-ink/[0.07] pt-2.5" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`rounded-[16px] bg-ink/[0.03] ring-1 ring-ink/[0.04] ${
          compact ? "px-3 py-2.5" : "px-4 py-3"
        }`}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] leading-relaxed text-ink-soft/85">
              {message}
            </p>
            <button
              type="button"
              onClick={() => onRevisit(primary.id)}
              className="touch-press mt-2 w-full rounded-[12px] bg-white/90 px-3 py-2.5 text-left ring-1 ring-ink/[0.04] active:scale-[0.995]"
            >
              <p className="line-clamp-1 text-[13px] font-semibold text-ink">
                {primary.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-soft/80">
                {primary.preview}
              </p>
              <p className="mt-1.5 text-[10px] font-medium text-ink-soft/60">
                {formatRevivalAge(primary.createdAt, lang)} · {t("보기 →", "View →")}
              </p>
            </button>

            {more.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="touch-press mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-ink-soft/70"
                  aria-expanded={expanded}
                >
                  {expanded
                    ? t("접기", "Show less")
                    : t(`+${more.length}개 더`, `+${more.length} more`)}
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={SPRING_DEFAULT}
                      className="overflow-hidden"
                    >
                      <div className="mt-1.5 space-y-1">
                        {more.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onRevisit(m.id)}
                            className="touch-press w-full rounded-[10px] px-2 py-2 text-left active:bg-ink/[0.04]"
                          >
                            <p className="line-clamp-1 text-[12px] font-medium text-ink">
                              {m.title}
                            </p>
                            <p className="text-[10px] text-ink-soft/65">
                              {formatRevivalAge(m.createdAt, lang)}
                            </p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="touch-target shrink-0 rounded-full text-ink-soft/50"
            aria-label={t("숨기기", "Hide")}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
