import {
  AlertCircle,
  CalendarDays,
  CheckSquare2,
  Lightbulb,
} from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useT } from "@/lib/i18n";
import { getAllBrowseEntries, type BrowseRecordEntry } from "@/lib/browseRecordModel";
import { classifyLocally } from "@/lib/localClassifier";
import type { InboxItem, ScheduleItem } from "@/lib/store";

type Props = {
  items: InboxItem[];
  schedules: ScheduleItem[];
  open: boolean;
  onClose: () => void;
  /** Render inside an existing sheet instead of stacking a second modal. */
  embedded?: boolean;
};

type SummaryBucket = "schedule" | "todo" | "thought" | "confirm";

function classifySummaryBucket(entry: BrowseRecordEntry): SummaryBucket {
  if (
    entry.kind === "record" &&
    entry.clarification_state === "pending" &&
    entry.status !== "done"
  ) {
    return "confirm";
  }

  if (entry.start_time && entry.status !== "done") {
    return "schedule";
  }

  const category = classifyLocally(entry.raw_text ?? entry.text)?.category;
  if (
    category === "task" ||
    category === "reminder" ||
    category === "shopping"
  ) {
    return "todo";
  }

  return "thought";
}

/**
 * V0.2 organize contract: this is a read-only AI summary, not a backlog or
 * cleanup queue. The four tiles describe ways the current records can be read;
 * they never imply that the user has work left to process.
 */
export function OrganizeSummarySheet({
  items,
  schedules,
  open,
  onClose,
  embedded = false,
}: Props) {
  const t = useT();
  const browsing = getAllBrowseEntries(items, schedules);
  const active = browsing.filter((entry) => entry.status !== "done");

  const buckets = active.reduce<Record<SummaryBucket, BrowseRecordEntry[]>>(
    (acc, entry) => {
      acc[classifySummaryBucket(entry)].push(entry);
      return acc;
    },
    { schedule: [], todo: [], thought: [], confirm: [] },
  );

  const tiles = [
    {
      key: "schedule",
      count: buckets.schedule.length,
      label: t("일정", "Schedule"),
      Icon: CalendarDays,
    },
    {
      key: "todo",
      count: buckets.todo.length,
      label: t("할 일", "To do"),
      Icon: CheckSquare2,
    },
    {
      key: "thought",
      count: buckets.thought.length,
      label: t("생각", "Thoughts"),
      Icon: Lightbulb,
    },
    {
      key: "confirm",
      count: buckets.confirm.length,
      label: t("확인 필요", "Needs confirmation"),
      Icon: AlertCircle,
    },
  ] as const;

  const recent = active.slice(0, 2);

  if (!open) return null;

  const content = (
    <div
      className="sheet-scroll px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      data-testid="organize-summary-sheet"
    >
      {embedded && (
        <button
          type="button"
          onClick={onClose}
          className="touch-press -ml-1 mb-1 inline-flex min-h-11 items-center px-1 text-[13px] font-semibold text-ink-soft"
        >
          {t("← 전체 기록", "← All records")}
        </button>
      )}

      <h2 className="quietly-hero-title mt-2 text-[28px]">
        {t("다 정리해뒀어요.", "Already organized.")}
      </h2>
      <p className="quietly-hero-sub mt-2">
        {t(
          "현재 기록을 이렇게 볼 수 있어요.",
          "Here are the useful views of your records.",
        )}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {tiles.map(({ key, count, label, Icon }) => (
          <div
            key={key}
            className="quietly-feedback-card flex min-h-[116px] flex-col justify-between gap-3 px-4 py-4"
            data-testid={`organize-tile-${key}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ink/[0.04] text-ink-soft">
                <Icon size={16} aria-hidden />
              </span>
              <p className="text-[36px] font-black tabular-nums leading-none tracking-[-0.05em] text-ink">
                {count}
              </p>
            </div>
            <p className="text-[13px] font-semibold text-ink-soft">{label}</p>
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <section className="mt-7">
          <h3 className="quietly-section-label mb-2">
            {t("최근 정리 결과", "Recently organized")}
          </h3>
          <div className="quietly-feedback-card divide-y divide-[var(--quietly-border)] px-1 py-1">
            {recent.map((entry) => {
              const bucket = classifySummaryBucket(entry);
              const meta =
                bucket === "schedule"
                  ? t("일정", "Schedule")
                  : bucket === "todo"
                    ? t("할 일", "To do")
                    : bucket === "confirm"
                      ? t("확인 필요", "Needs confirmation")
                      : t("생각", "Thought");
              const Icon =
                bucket === "schedule"
                  ? CalendarDays
                  : bucket === "todo"
                    ? CheckSquare2
                    : bucket === "confirm"
                      ? AlertCircle
                      : Lightbulb;

              return (
                <div
                  key={`${entry.kind}:${entry.id}`}
                  className="flex items-start gap-2.5 px-3 py-3"
                >
                  <Icon size={16} className="mt-0.5 text-ink-soft" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">
                      {entry.text.trim() || t("(내용 없음)", "(No text)")}
                    </p>
                    <p className="mt-0.5 text-[12px] font-medium text-ink-soft">
                      {meta}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-soft/75">
        {t(
          "숫자는 해야 할 일의 잔량이 아니라, 지금 기록을 보는 방식이에요.",
          "These numbers are views of your records, not work left to clear.",
        )}
      </p>
    </div>
  );

  if (embedded) return content;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="84dvh"
      title={t("정리하기", "Organize")}
    >
      {content}
    </BottomSheet>
  );
}
