import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ComponentType } from "react";
import type { ArchiveItem, ScheduleItem } from "@/lib/store";
import { useT, useLang } from "@/lib/i18n";
import { formatRemainingLong } from "@/lib/scheduleTime";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";
import { pickTodaySuggestion } from "@/lib/todaySuggestions";
import { MOTION_CRAFT } from "@/lib/motionLanguage";

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
    <div className="flex flex-col gap-8 animate-craft-in px-0.5 pb-4 pt-3">
      {spotlight && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={MOTION_CRAFT}
          className="px-1"
        >
          <p className="craft-hero">{scheduleDisplayTitle(spotlight)}</p>
          <p className="mt-3 text-[14px] font-medium leading-relaxed tracking-[0.005em] text-ink-soft/90">
            {formatRemainingLong(new Date(spotlight.start_time), lang)}
          </p>
        </motion.section>
      )}

      {suggestion && (
        <TodaySuggestionCard
          message={lang === "en" ? suggestion.messageEn : suggestion.messageKo}
          rediscoveryPath={suggestion.rediscoveryPath}
        />
      )}

      {alsoToday.length > 0 && (
        <section className="flex flex-col gap-3 px-0.5">
          <p className="text-[12px] font-medium tracking-[0.02em] text-ink-soft/65">
            {t("오늘 더 있어요", "Also today")}
          </p>
          <div className="flex flex-col gap-3 opacity-[0.82]">
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
        <p className="px-4 text-center text-[14px] leading-[1.7] text-ink-soft/85">
          {t(
            "오늘은 특별히 떠올릴 게 없어요. 괜찮아요.",
            "Nothing needs your attention today — and that's okay.",
          )}
        </p>
      )}
    </div>
  );
}

function TodaySuggestionCard({
  message,
  rediscoveryPath,
}: {
  message: string;
  rediscoveryPath?: boolean;
}) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOTION_CRAFT, delay: 0.1 }}
      className="craft-suggestion"
    >
      <p className="text-[14px] leading-[1.65] tracking-[0.005em] text-ink/88">
        {message}
        {rediscoveryPath && (
          <span className="font-medium text-ink-soft/90"> →</span>
        )}
      </p>
    </motion.div>
  );

  if (rediscoveryPath) {
    return (
      <Link to="/rediscovery" className="block touch-press active:opacity-90">
        {inner}
      </Link>
    );
  }

  return inner;
}
