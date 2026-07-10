import { Link, useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useArchive, useSchedules } from "@/lib/store";
import { useT, useLang } from "@/lib/i18n";
import { archiveDisplayTitle, recordArchiveVisit } from "@/lib/archiveMeta";
import {
  dismissRediscovery,
  pickRediscoveryCandidate,
  markRediscoverySessionShown,
  revivalHeaderKo,
} from "@/lib/rediscoveryPick";
import { setRevivalJumpTarget } from "@/lib/memoryRevival";
import { MOTION_CRAFT } from "@/lib/motionLanguage";

export const Route = createFileRoute("/rediscovery")({
  component: RediscoveryPage,
});

function RediscoveryPage() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const archive = useArchive();
  const schedules = useSchedules();
  const [dismissed, setDismissed] = useState(false);

  const pick = useMemo(
    () => pickRediscoveryCandidate(archive.items, schedules.items),
    [archive.items, schedules.items],
  );

  if (!pick || dismissed) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center px-8 text-center">
        <p className="text-[17px] font-semibold text-ink">
          {t("지금은 다시 만날 기억이 없어요", "Nothing to revisit right now")}
        </p>
        <p className="mt-2 text-[14px] text-ink-soft">
          {t("조용히 기다리고 있을게요.", "We'll wait quietly.")}
        </p>
        <Link
          to="/schedule"
          className="touch-press mt-6 rounded-full bg-primary px-6 py-3 text-[14px] font-bold text-ink"
        >
          {t("오늘 보기", "See today")}
        </Link>
      </div>
    );
  }

  const { memory, ageKo, ageEn, nudgeKo, nudgeEn } = pick;
  const age = lang === "en" ? ageEn : ageKo;
  const nudge = lang === "en" ? nudgeEn : nudgeKo;
  const title = archiveDisplayTitle(memory.id, memory);

  const onView = () => {
    markRediscoverySessionShown();
    recordArchiveVisit(memory.id);
    setRevivalJumpTarget(memory.id);
    navigate({ to: "/archive" });
  };

  const onDone = () => {
    dismissRediscovery(memory.id);
    setDismissed(true);
  };

  const onHide = () => {
    dismissRediscovery(memory.id);
    setDismissed(true);
  };

  return (
    <div className="craft-surface-warm flex min-h-full flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-12">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={MOTION_CRAFT}
        className="page-eyebrow text-center"
      >
        {lang === "en"
          ? `A thought from ${age}`
          : revivalHeaderKo(ageKo)}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...MOTION_CRAFT, delay: 0.1 }}
        className="mx-auto mt-10 w-full max-w-[340px] rounded-[30px] bg-white px-7 py-9 shadow-craft ring-1 ring-ink/[0.04]"
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
        <p className="mt-4 line-clamp-4 text-[15px] leading-[1.68] tracking-[0.005em] text-ink/82">
          {memory.raw_text ?? memory.text}
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
        <button
          type="button"
          onClick={onView}
          className="touch-press w-full rounded-full bg-primary py-4 text-[15px] font-bold tracking-[-0.01em] text-ink shadow-craft"
        >
          {t("보기", "View")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="touch-press w-full rounded-full border border-ink/[0.08] bg-white/90 py-4 text-[15px] font-semibold tracking-[-0.01em] text-ink shadow-card"
        >
          {t("완료했어요", "I'm done")}
        </button>
        <button
          type="button"
          onClick={onHide}
          className="touch-press py-2.5 text-[13px] font-medium text-ink-soft/65"
        >
          {t("다시 보지 않기", "Don't show again")}
        </button>
      </div>
    </div>
  );
}
