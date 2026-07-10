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
import { MOTION_THINKING } from "@/lib/motionLanguage";

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
    <div className="flex min-h-full flex-col bg-[#faf9f6] px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-8">
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={MOTION_THINKING}
        className="text-center text-[13px] font-medium text-ink-soft"
      >
        {lang === "en"
          ? `A thought from ${age}`
          : revivalHeaderKo(ageKo)}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...MOTION_THINKING, delay: 0.06 }}
        className="mx-auto mt-8 w-full max-w-[340px] rounded-[28px] bg-white px-6 py-8 shadow-card ring-1 ring-ink/[0.05]"
      >
        <p className="text-[12px] text-ink-soft">
          {new Date(memory.created_at).toLocaleDateString(
            lang === "en" ? "en-US" : "ko-KR",
            { month: "long", day: "numeric" },
          )}
        </p>
        <h1 className="mt-2 text-[22px] font-bold leading-snug tracking-[-0.02em] text-ink">
          {title}
        </h1>
        <p className="mt-3 line-clamp-4 text-[15px] leading-[1.6] text-ink/85">
          {memory.raw_text ?? memory.text}
        </p>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.14 }}
        className="mx-auto mt-8 max-w-[300px] text-center text-[15px] leading-[1.55] text-ink-soft"
      >
        {nudge}
      </motion.p>

      <div className="mx-auto mt-8 flex w-full max-w-[340px] flex-col gap-2.5">
        <button
          type="button"
          onClick={onView}
          className="touch-press w-full rounded-full bg-primary py-4 text-[15px] font-bold text-ink shadow-card"
        >
          {t("보기", "View")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="touch-press w-full rounded-full border border-ink/10 bg-white py-4 text-[15px] font-semibold text-ink"
        >
          {t("완료했어요", "I'm done")}
        </button>
        <button
          type="button"
          onClick={onHide}
          className="touch-press py-2 text-[13px] font-medium text-ink-soft/70"
        >
          {t("다시 보지 않기", "Don't show again")}
        </button>
      </div>
    </div>
  );
}
