import { Check, Clock, List, CalendarOff } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useT } from "@/lib/i18n";
import { getBrowsableRecords } from "@/lib/canonicalBrowse";
import type { InboxItem } from "@/lib/store";

type Props = {
  items: InboxItem[];
  open: boolean;
  onClose: () => void;
  /** Render inside an existing sheet instead of stacking a second modal. */
  embedded?: boolean;
};

/**
 * Factual organize summary from canonical state only.
 * Do not present heuristic buckets as AI understanding: until a real classifier
 * exists, counts are limited to date/status facts the product can guarantee.
 */
export function OrganizeSummarySheet({
  items,
  open,
  onClose,
  embedded = false,
}: Props) {
  const t = useT();
  const browsing = getBrowsableRecords(items);
  const schedule = browsing.filter(
    (i) => Boolean(i.start_time) && i.status !== "done",
  );
  const undated = browsing.filter(
    (i) => !i.start_time && i.status !== "done",
  );
  const done = browsing.filter((i) => i.status === "done");

  const tiles = [
    {
      key: "schedule",
      count: schedule.length,
      label: t("일정", "Schedule"),
      Icon: Clock,
    },
    {
      key: "undated",
      count: undated.length,
      label: t("날짜 없음", "No date"),
      Icon: CalendarOff,
    },
    {
      key: "done",
      count: done.length,
      label: t("완료", "Completed"),
      Icon: Check,
    },
    {
      key: "all",
      count: browsing.length,
      label: t("전체", "All records"),
      Icon: List,
    },
  ] as const;

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
        {t("기록을 이렇게 볼 수 있어요.", "Here’s a clear view of your records.")}
      </h2>
      <p className="quietly-hero-sub mt-2">
        {t(
          "날짜와 상태처럼 확실한 정보만 기준으로 나눴어요.",
          "Grouped only by facts like date and status.",
        )}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {tiles.map(({ key, count, label, Icon }) => (
          <div
            key={key}
            className="quietly-feedback-card flex flex-col gap-2 px-4 py-4"
            data-testid={`organize-tile-${key}`}
          >
            <Icon size={18} className="text-ink-soft" aria-hidden />
            <p className="text-[36px] font-black tabular-nums leading-none tracking-[-0.05em] text-ink">
              {count}
            </p>
            <p className="text-[13px] font-medium text-ink-soft">{label}</p>
          </div>
        ))}
      </div>

      {(schedule[0] || undated[0]) && (
        <section className="mt-7">
          <h3 className="quietly-section-label mb-2">
            {t("최근 기록", "Recent records")}
          </h3>
          <div className="quietly-feedback-card divide-y divide-[var(--quietly-border)] px-1 py-1">
            {schedule[0] && (
              <div className="flex items-start gap-2.5 px-3 py-3">
                <Clock size={16} className="mt-0.5 text-ink-soft" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink">
                    {schedule[0].text.trim() || t("(내용 없음)", "(No text)")}
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-ink-soft">
                    {t("일정", "Schedule")}
                  </p>
                </div>
              </div>
            )}
            {undated[0] && (
              <div className="flex items-start gap-2.5 px-3 py-3">
                <CalendarOff size={16} className="mt-0.5 text-ink-soft" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink">
                    {undated[0].text.trim() || t("(내용 없음)", "(No text)")}
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-ink-soft">
                    {t("날짜 없음", "No date")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
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
