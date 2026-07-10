import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ComponentType } from "react";
import type { ArchiveItem, ScheduleItem } from "@/lib/store";
import { useT, useLang } from "@/lib/i18n";
import { formatRemainingLong } from "@/lib/scheduleTime";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";
import { pickTodaySuggestion } from "@/lib/todaySuggestions";
import { MOTION_THINKING } from "@/lib/motionLanguage";

type Props = {
  todayItems: ScheduleItem[];
  activeItems: ScheduleItem[];
  archiveItems: ArchiveItem[];
  doneCount: number;
  ScheduleCard: ComponentType<Record<string, unknown>>;
  cardProps: (s: ScheduleItem) => Record<string, unknown>;
  DoneSection: ComponentType<{
    items: ScheduleItem[];
    cardProps: (s: ScheduleItem) => Record<string, unknown>;
    t: ReturnType<typeof useT>;
  }>;
  doneItems: ScheduleItem[];
};

export function TodayExperience({
  todayItems,
  activeItems,
  archiveItems,
  doneCount,
  ScheduleCard,
  cardProps,
  DoneSection,
  doneItems,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const suggestion = pickTodaySuggestion(
    todayItems,
    activeItems,
    archiveItems,
    lang,
  );
  const spotlight = todayItems[0] ?? null;
  const alsoToday = todayItems.slice(1);

  return (
    <div className="flex flex-col gap-6 animate-fade-in pt-1">
      {spotlight && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={MOTION_THINKING}
        >
          <p className="text-[22px] font-bold leading-[1.35] tracking-[-0.02em] text-ink">
            {scheduleDisplayTitle(spotlight)}
          </p>
          <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">
            {formatRemainingLong(new Date(spotlight.start_time), lang)}
          </p>
        </motion.section>
      )}

      {suggestion && (
        <TodaySuggestionLine
          message={lang === "en" ? suggestion.messageEn : suggestion.messageKo}
          rediscoveryPath={suggestion.rediscoveryPath}
        />
      )}

      {alsoToday.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <p className="text-[13px] text-ink-soft/75">
            {t("오늘 더 있어요", "Also today")}
          </p>
          <div className="flex flex-col gap-2.5 opacity-[0.88]">
            {alsoToday.map((s) => (
              <ScheduleCard key={s.id} {...cardProps(s)} timer />
            ))}
          </div>
        </section>
      )}

      {doneItems.length > 0 && (
        <DoneSection items={doneItems} cardProps={cardProps} t={t} />
      )}

      {todayItems.length === 0 && doneCount === 0 && (
        <p className="text-center text-[14px] leading-relaxed text-ink-soft/90">
          {t(
            "오늘은 특별히 떠올릴 게 없어요. 괜찮아요.",
            "Nothing needs your attention today — and that's okay.",
          )}
        </p>
      )}
    </div>
  );
}

function TodaySuggestionLine({
  message,
  rediscoveryPath,
}: {
  message: string;
  rediscoveryPath?: boolean;
}) {
  const inner = (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOTION_THINKING, delay: 0.08 }}
      className="text-[14px] leading-[1.6] text-ink-soft/90"
    >
      {message}
      {rediscoveryPath && (
        <span className="font-medium text-ink-soft"> →</span>
      )}
    </motion.p>
  );

  if (rediscoveryPath) {
    return (
      <Link to="/rediscovery" className="block touch-press active:opacity-80">
        {inner}
      </Link>
    );
  }

  return inner;
}
