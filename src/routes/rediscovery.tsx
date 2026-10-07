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
  type RediscoveryPick,
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
  const [selectedPick, setSelectedPick] = useState<RediscoveryPick | null>(null);
  const impressionIdRef = useRef<string | null>(null);
  const enabled = featureEnabled("REDISCOVERY");

  const pool = useMemo(
    () => buildRediscoveryPool(inbox.items, archive.items),
    [inbox.items, archive.items],
  );
  const candidate = useMemo(
    () => pickRediscoveryCandidate(pool, schedules.items),
    [pool, schedules.items],
  );

  const selectedStillExists = selectedPick
    ? pool.some((memory) => (memory.source_id ?? memory.id) === selectedPick.key)
    : false;
  const pick = selectedStillExists ? selectedPick : candidate;

  useEffect(() => {
    if (!selectedPick && candidate) {
      setSelectedPick(candidate);
      return;
    }
    if (selectedPick && !selectedStillExists) {
      setSelectedPick(null);
    }
  }, [candidate, selectedPick, selectedStillExists]);

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
          {t("새 기록 남기기", "Capture something new")}
        </Link>
      </div>
    );
  }

  const { memory, ageKo, ageEn, nudgeKo, nudgeEn, reason, relatedContext } = pick;
  const age = lang === "en" ? ageEn : ageKo;
  const title = rediscoveryDisplayTitle(memory);
  const fullText = memory.raw_text ?? memory.text;
  const relatedContextTitle = relatedContext
    ? rediscoveryDisplayTitle(relatedContext)
    : null;

  const reasonLabel =
    reason === "upcoming_schedule"
      ? t("곧 필요한 기록이에요", "You may need this soon")
      : reason === "related_capture"
        ? t("방금 남긴 생각과 이어져요", "This connects with what you just captured")
        : reason === "long_unvisited"
          ? t("오래 묻혀 있던 기록이에요", "This has been quiet for a while")
          : t("오늘 다시 떠올려볼 기록이에요", "Worth bringing back today");

  const reasonText = lang === "en" ? nudgeEn : nudgeKo;

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
    <div className="craft-surface-warm flex min-h-full flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={MOTION_CRAFT}
        className="mx-auto w-full max-w-[340px]"
      >
        <p className="text-[12px] font-semibold tracking-[0.04em] text-ink-soft/70">
          {t("다시 발견", "RESURFACED")}
        </p>
        <h1 className="mt-2 text-[25px] font-bold leading-[1.32] tracking-[-0.04em] text-ink">
          {reasonLabel}
        </h1>
        <p className="mt-2 text-[14px] leading-[1.6] text-ink-soft">
          {reasonText}
        </p>
      </motion.div>

      {reason === "related_capture" && relatedContextTitle && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...MOTION_CRAFT, delay: 0.05 }}
          className="mx-auto mt-5 w-full max-w-[340px] rounded-[18px] border border-ink/[0.06] bg-white/70 px-4 py-3"
          data-testid="rediscovery-context-bridge"
        >
          <p className="text-[11px] font-semibold tracking-[0.02em] text-ink-soft/65">
            {t("방금 남긴 기록", "RECENT CONTEXT")}
          </p>
          <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-[1.45] text-ink/85">
            {relatedContextTitle}
          </p>
          <p className="mt-1 text-[12px] leading-[1.45] text-ink-soft/75">
            {t("같은 주제가 보여 예전 기록을 다시 연결했어요.", "A shared topic brought an older record back.")}
          </p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 14, rotate: -1.4 }}
        animate={{ opacity: 1, y: 0, rotate: -0.4 }}
        transition={{ ...MOTION_CRAFT, delay: 0.08 }}
        className="mx-auto mt-8 w-full max-w-[340px] rounded-[26px] bg-[#FFF3A8] px-7 py-8 shadow-craft ring-1 ring-ink/[0.05]"
        data-testid="rediscovery-card"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold tracking-[0.01em] text-ink-soft/75">
            {lang === "en" ? `Saved ${age}` : revivalHeaderKo(ageKo)}
          </p>
          <span className="text-[12px] font-bold text-ink/45">&gt;ij&lt;</span>
        </div>

        <h2 className="mt-5 text-[24px] font-bold leading-[1.3] tracking-[-0.035em] text-ink">
          {title}
        </h2>
        <p
          className={`mt-4 text-[15px] leading-[1.68] tracking-[0.005em] text-ink/82 ${expanded ? "whitespace-pre-wrap" : "line-clamp-4"}`}
          data-testid="rediscovery-record-text"
        >
          {fullText}
        </p>

        {expanded && (
          <div className="mt-6 rounded-2xl bg-white/55 px-4 py-3">
            <p className="text-[12px] font-semibold text-ink-soft/80">
              {t("왜 지금 보여줬나요?", "Why now?")}
            </p>
            <p className="mt-1 text-[13px] leading-[1.55] text-ink/80">
              {reason === "upcoming_schedule"
                ? t(
                    "연결된 일정이 7일 안으로 다가오고 있어요.",
                    "A connected schedule is within the next 7 days.",
                  )
                : reason === "related_capture"
                  ? t(
                      "최근 남긴 기록과 겹치는 주제가 있어 함께 떠올려볼 수 있게 꺼냈어요.",
                      "A recent capture shares this topic, so this older record resurfaced with it.",
                    )
                  : reason === "long_unvisited"
                    ? t(
                        "오랫동안 다시 열어보지 않은 기록이라 조용히 꺼냈어요.",
                        "You haven't opened this in a while, so it surfaced quietly.",
                      )
                    : t(
                        "최근 다시 보지 않은 기록 중 하나를 가볍게 꺼냈어요.",
                        "This is one of your recent records that hasn't resurfaced yet.",
                      )}
            </p>
          </div>
        )}
      </motion.div>

      <div className="mx-auto mt-8 flex w-full max-w-[340px] flex-col gap-3">
        {!expanded && (
          <button
            type="button"
            onClick={onView}
            className="touch-press w-full rounded-full bg-primary py-4 text-[15px] font-bold tracking-[-0.01em] text-ink shadow-craft"
          >
            {t("기록 자세히 보기", "Open this record")}
          </button>
        )}

        {expanded && reason === "upcoming_schedule" && (
          <Link
            to="/schedule"
            className="touch-press w-full rounded-full bg-primary py-4 text-center text-[15px] font-bold tracking-[-0.01em] text-ink shadow-craft"
          >
            {t("연결된 일정 보기", "View connected schedule")}
          </Link>
        )}

        <button
          type="button"
          onClick={onLater}
          className="touch-press w-full rounded-full border border-ink/[0.08] bg-white/90 py-4 text-[15px] font-semibold tracking-[-0.01em] text-ink shadow-card"
        >
          {t("3일 뒤 다시", "Bring it back in 3 days")}
        </button>
        <button
          type="button"
          onClick={onHide}
          className="touch-press py-2.5 text-[13px] font-medium text-ink-soft/65"
        >
          {t("이 기록은 이제 그만", "Done with this record")}
        </button>
      </div>

      <Link
        to="/"
        className="mx-auto mt-7 text-[13px] font-medium text-ink-soft/60 underline decoration-ink/15 underline-offset-4"
      >
        {t("새 기록 남기기", "Capture something new")}
      </Link>
    </div>
  );
}
