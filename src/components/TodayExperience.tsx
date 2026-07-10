import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ComponentType, ReactNode } from "react";
import type { ArchiveItem, ScheduleItem } from "@/lib/store";
import { CountdownRing } from "@/components/CountdownRing";
import { useT, useLang } from "@/lib/i18n";
import {
  countdownRingProgress,
  formatRemainingLong,
  scheduleDotStatus,
} from "@/lib/scheduleTime";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";
import {
  formatTodayHeaderDate,
  pickTodaySuggestion,
  weekStripDays,
  type TodaySuggestion,
} from "@/lib/todaySuggestions";
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
  const now = new Date();
  const week = weekStripDays(now);
  const suggestion = pickTodaySuggestion(
    todayItems,
    activeItems,
    archiveItems,
    lang,
  );
  const spotlight = todayItems[0] ?? null;

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <p className="text-[13px] font-medium text-ink-soft">
          {formatTodayHeaderDate(lang, now)}
        </p>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {week.map((d) => {
            const isToday = d.toDateString() === now.toDateString();
            return (
              <div
                key={d.toISOString()}
                className={`flex min-w-[2.75rem] flex-col items-center rounded-full px-2 py-2 ${
                  isToday ? "bg-ink text-white" : "bg-ink/[0.04] text-ink-soft"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase">
                  {d.toLocaleDateString(lang === "en" ? "en-US" : "ko-KR", {
                    weekday: "short",
                  })}
                </span>
                <span className="font-num text-[15px] font-bold">
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {spotlight && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={MOTION_THINKING}
          className="rounded-[24px] bg-primary/12 px-5 py-5 ring-1 ring-primary/25"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            {t("다음에 떠올릴 것", "Next up")}
          </p>
          <div className="mt-3 flex items-center gap-4">
            <CountdownRing
              progress={countdownRingProgress(
                spotlight.start_time,
                spotlight.created_at,
              )}
              target={new Date(spotlight.start_time)}
              lang={lang}
              size={64}
              urgent={
                scheduleDotStatus(new Date(spotlight.start_time)) === "urgent"
              }
            />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold leading-snug text-ink">
                {scheduleDisplayTitle(spotlight)}
              </p>
              <p className="mt-1 text-[13px] text-ink-soft">
                {formatRemainingLong(new Date(spotlight.start_time), lang)}
              </p>
            </div>
          </div>
        </motion.section>
      )}

      {suggestion && <TodaySuggestionCard suggestion={suggestion} />}

      {todayItems.length > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-bold text-ink">
            {t("예정된 것", "Coming up")}
          </h2>
          <div className="flex flex-col gap-3">
            {todayItems.map((s) => (
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
            "오늘은 비워둬도 괜찮아요. 생각이 오면 여기 있을 거예요.",
            "Nothing needs you today — thoughts can wait here.",
          )}
        </p>
      )}
    </div>
  );
}

function TodaySuggestionCard({ suggestion }: { suggestion: TodaySuggestion }) {
  const t = useT();
  const { lang } = useLang();
  const message = lang === "en" ? suggestion.messageEn : suggestion.messageKo;

  const inner: ReactNode = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOTION_THINKING, delay: 0.08 }}
      className="rounded-[20px] bg-ink/[0.04] px-4 py-4 ring-1 ring-ink/[0.05]"
    >
      <p className="text-[11px] font-semibold text-ink-soft/80">
        {t("ItJima의 제안", "A gentle nudge")}
      </p>
      <p className="mt-2 text-[14px] leading-[1.55] text-ink/90">{message}</p>
      {suggestion.rediscoveryPath && (
        <p className="mt-2 text-[12px] font-semibold text-ink-soft">
          {t("다시 만나기 →", "Revisit →")}
        </p>
      )}
    </motion.div>
  );

  if (suggestion.rediscoveryPath) {
    return (
      <Link to="/rediscovery" className="block touch-press active:opacity-90">
        {inner}
      </Link>
    );
  }

  return inner;
}
