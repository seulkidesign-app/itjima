import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useArchive, useInbox, useSchedules } from "@/lib/store";
import { useT, useLang } from "@/lib/i18n";
import { recordArchiveVisit } from "@/lib/archiveMeta";
import {
  buildRediscoveryPool,
  dismissRediscovery,
  pickRediscoveryCandidate,
  markRediscoverySessionShown,
  rediscoveryDisplayTitle,
  revivalHeaderKo,
  snoozeRediscovery,
} from "@/lib/rediscoveryPick";
import { MOTION_CRAFT } from "@/lib/motionLanguage";
import { featureEnabled } from "@/lib/features";
import { trackRediscoveryUt } from "@/lib/rediscoveryAnalytics";

export const Route = createFileRoute("/rediscovery")({
  component: RediscoveryPage,
});

function RediscoveryPage() {
  const t = useT();
  const { lang } = useLang();
  const inbox = useInbox();
  const archive = useArchive();
  const schedules = useSchedules();
  const [handled, setHandled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const impressionIdRef = useRef<string | null>(null);
  const enabled = featureEnabled("REDISCOVERY");

  const pool = useMemo(
    () => buildRediscoveryPool(inbox.items, archive.items),
    [inbox.items, archive.items],
  );
  const pick = useMemo(
    () => pickRediscoveryCandidate(pool, schedules.items),
    [pool, schedules.items],
  );

  useEffect(() => {
    if (!enabled || !pick || handled) return;
    if (impressionIdRef.current === pick.key) return;
    impressionIdRef.current = pick.key;
    markRediscoverySessionShown(pick.key);
    trackRediscoveryUt("impression", pick);
  }, [enabled, pick, handled]);

  if (!enabled) {
    return (
      <div
        className="flex min-h-[60dvh] flex-col items-center justify-center px-8 text-center"
        data-testid="rediscovery-locked"
      >
        <p className="text-[17px] font-semibold text-ink">
          {t("아직 준비 중인 기능이에요", "This feature is still being tested")}
        </p>
        <p className="mt-2 text-[14px] text-ink-soft">
          {t(
            "검증이 끝나면 조용히 다시 만날 수 있게 할게요.",
            "It will return quietly after validation.",
          )}
        </p>
        <Link
          to="/"
          className="touch-press mt-6 rounded-full bg-primary px-6 py-3 text-[14px] font-bold text-ink"
        >
          {t("남기기로 돌아가기", "Back to Capture")}
        </Link>
      </div>
    );
  }

  if (!pick || handled) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center px-8 text-center">
        <p className="text-[17px] font-semibold text-ink">
          {t("지금은 다시 볼 기록이 없어요", "Nothing to revisit right now")}
        </p>
        <p className="mt-2 text-[14px] text-ink-soft">
          {t("필요할 때 다시 보여드릴게요.", "We'll bring something back when it may help.")}
        </p>
        <Link
          to="/"
          className="touch-press mt-6 rounded-full bg-primary px-6 py-3 text-[14px] font-bold text-ink"
        >
          {t("남기기로 돌아가기", "Back to Capture")}
        </Link>
      </div>
    );
  }

  const { memory, ageKo, ageEn, nudgeKo, nudgeEn } = pick;
  const age = lang === "en" ? ageEn : ageKo;
  const nudge = lang === "en" ? nudgeEn : nudgeKo;
  const title = rediscoveryDisplayTitle(memory);
  const fullText = memory.raw_text ?? memory.text;

  const onView = () => {
    if (!expanded) {
      trackRediscoveryUt("open", pick);
      recordArchiveVisit(pick.key);
    }
    setExpanded(true);
  };

  const onLater = () => {
    trackRediscoveryUt("later", pick);
    snoozeRediscovery(pick.key);
    setHandled(true);
  };

  const onHide = () => {
    trackRediscoveryUt("hide", pick);
    dismissRediscovery(pick.key);
    setHandled(true);
  };

  return (
    <div className="craft-surface-warm flex min-h-full flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-12">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={MOTION_CRAFT}
        className="page-eyebrow text-center"
      >
        {lang === "en" ? `A record from ${age}` : revivalHeaderKo(ageKo)}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...MOTION_CRAFT, delay: 0.1 }}
        className="mx-auto mt-10 w-full max-w-[340px] rounded-[30px] bg-white px-7 py-9 shadow-craft ring-1 ring-ink/[0.04]"
        data-testid="rediscovery-card"
      >
        <p className="text-[12px] font-medium tracking-[0.01em] text-ink-soft/80">
          {new Date(memory.created_at).toLocaleDateString(
            lang === "en" ? "en-US" : "ko-KR",
            { month: "long", day: "numeric" },
          )}
        </p>
        <h1 className="mt-2.5 text-[24px] font-bold leading-[1.3] tracking-[-0.03em] text-ink">
          {title}
        </h1>
        <p
          className={`mt-4 text-[15px] leading-[1.68] tracking-[0.005em] text-ink/82 ${expanded ? "whitespace-pre-wrap" : "line-clamp-4"}`}
          data-testid="rediscovery-record-text"
        >
          {fullText}
        </p>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...MOTION_CRAFT, delay: 0.22 }}
        className="mx-auto mt-10 max-w-[280px] text-center text-[15px] leading-[1.6] tracking-[0.005em] text-ink-soft/90"
      >
        {nudge}
      </motion.p>

      <div className="mx-auto mt-10 flex w-full max-w-[340px] flex-col gap-3">
        {!expanded && (
          <button
            type="button"
            onClick={onView}
            className="touch-press w-full rounded-full bg-primary py-4 text-[15px] font-bold tracking-[-0.01em] text-ink shadow-craft"
          >
            {t("기록 보기", "View record")}
          </button>
        )}
        <button
          type="button"
          onClick={onLater}
          className={`touch-press w-full rounded-full py-4 text-[15px] font-semibold tracking-[-0.01em] text-ink shadow-card ${expanded ? "bg-primary font-bold shadow-craft" : "border border-ink/[0.08] bg-white/90"}`}
        >
          {t("나중에 다시", "Later")}
        </button>
        <button
          type="button"
          onClick={onHide}
          className="touch-press py-2.5 text-[13px] font-medium text-ink-soft/65"
        >
          {t("그만 보기", "Don't show this again")}
        </button>
      </div>
    </div>
  );
}
