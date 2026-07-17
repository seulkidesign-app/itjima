import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { BrainMirrorResult } from "@/lib/brainMirror";
import { useT } from "@/lib/i18n";
import { SPRING_DEFAULT } from "@/lib/motion";

const BANNED_COPY =
  /AI|분석|요약|generated|organized|prediction|understanding|summary|analysis|인공지능/i;

export function isAllowedMirrorCopy(text: string): boolean {
  const s = text.trim();
  if (!s) return false;
  if (BANNED_COPY.test(s)) return false;
  if (/^(이렇게|제가|저장|등록|처리|넣어)/.test(s)) return false;
  return true;
}

type BodyProps = {
  result: BrainMirrorResult;
  compact?: boolean;
  showDateHint?: boolean;
  dateLabel?: string | null;
};

export function BrainMirrorReflectionBody({
  result,
  compact,
  showDateHint,
  dateLabel,
}: BodyProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const foldAt = compact ? 2 : 3;
  const needsFold = result.items.length > foldAt;
  const visibleItems = needsFold && !expanded
    ? result.items.slice(0, foldAt)
    : result.items;

  const dateHint =
    showDateHint && dateLabel && isAllowedMirrorCopy(dateLabel)
      ? dateLabel
      : null;
  const actionHint =
    result.suggestedAction?.trim() && isAllowedMirrorCopy(result.suggestedAction)
      ? result.suggestedAction.trim()
      : null;

  const titleClass = compact
    ? "text-[13px] font-medium leading-snug text-ink/75"
    : "text-[15px] font-medium leading-snug text-ink/80";
  const itemClass = compact
    ? "text-[12px] leading-relaxed text-ink/65"
    : "text-[14px] leading-relaxed text-ink/70";

  return (
    <>
      <p className={titleClass}>{result.title}</p>
      {visibleItems.length > 0 && (
        <ul className={`${compact ? "mt-1" : "mt-2"} space-y-0.5`}>
          {visibleItems.map((line) => (
            <li key={line} className={itemClass}>
              {line}
            </li>
          ))}
        </ul>
      )}
      {needsFold && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`touch-press inline-flex items-center gap-0.5 ${compact ? "mt-1" : "mt-2"} text-[11px] font-medium text-ink-soft/70`}
          aria-expanded={expanded}
        >
          {expanded
            ? t("접기", "Show less")
            : t(`+${result.items.length - foldAt}개 더`, `+${result.items.length - foldAt} more`)}
          <ChevronDown
            size={12}
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      )}
      {(dateHint || actionHint) && (
        <p className={`${compact ? "mt-1.5" : "mt-2.5"} text-[11px] leading-relaxed text-ink-soft/75`}>
          {actionHint ?? (dateHint ? `📅 ${dateHint}` : null)}
        </p>
      )}
    </>
  );
}

type ActionsProps = {
  compact?: boolean;
  showDateOffer?: boolean;
  acting?: boolean;
  onAcceptDate?: () => void;
  onKeepHere?: () => void;
  onDismiss?: () => void;
};

export function BrainMirrorReflectionActions({
  compact,
  showDateOffer,
  acting,
  onAcceptDate,
  onKeepHere,
  onDismiss,
}: ActionsProps) {
  const t = useT();

  return (
    <div className={`flex flex-col ${compact ? "mt-2 gap-1" : "mt-3 gap-1.5"}`}>
      {showDateOffer && (
        <>
          <button
            type="button"
            disabled={acting}
            onClick={onAcceptDate}
            className={`touch-press w-full rounded-full bg-ink/[0.08] py-2 text-[12px] font-semibold text-ink disabled:opacity-50 ${
              compact ? "" : "py-2.5"
            }`}
          >
            {t("그때 기억하기", "Remember for then")}
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={onKeepHere}
            className="touch-press w-full rounded-full py-2 text-[12px] font-medium text-ink-soft disabled:opacity-50"
          >
            {t("여기에 둘게요", "Keep it here")}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="touch-press py-0.5 text-[11px] font-medium text-ink-soft/65"
      >
        {t("숨기기", "Hide")}
      </button>
    </div>
  );
}

type ShellProps = {
  visible: boolean;
  compact?: boolean;
  children: React.ReactNode;
};

export function BrainMirrorReflectionShell({
  visible,
  compact,
  children,
}: ShellProps) {
  const t = useT();
  const reflectionLabel = t("다시 이해하기", "Understand again");
  if (!visible) return null;

  if (compact) {
    return (
      <motion.div
        role="complementary"
        aria-label={reflectionLabel}
        className="mt-2.5 border-t border-ink/[0.07] pt-2.5"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_DEFAULT, duration: 0.38 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      role="complementary"
      aria-label={reflectionLabel}
      className="mt-3 border-t border-ink/[0.07] pt-3"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_DEFAULT, duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}

export function BrainMirrorRestoreLink({ onRestore }: { onRestore: () => void }) {
  const t = useT();
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      onClick={onRestore}
      className="touch-press mt-1.5 text-[11px] font-medium text-ink-soft/55"
    >
      {t("다시 보기", "Show again")}
    </motion.button>
  );
}
