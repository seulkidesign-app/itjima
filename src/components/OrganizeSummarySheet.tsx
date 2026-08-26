import { Check, Clock, HelpCircle, Pencil } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useT } from "@/lib/i18n";
import { getBrowsableRecords } from "@/lib/canonicalBrowse";
import type { InboxItem } from "@/lib/store";

type Props = {
  items: InboxItem[];
  open: boolean;
  onClose: () => void;
};

/**
 * Figma 32 Organize Summary — presentation-only counts from canonical browse.
 * Soft “확인 필요” (not debt). Does not invent records or change mutations.
 */
export function OrganizeSummarySheet({ items, open, onClose }: Props) {
  const t = useT();
  const browsing = getBrowsableRecords(items);
  const schedule = browsing.filter(
    (i) => Boolean(i.start_time) && i.status !== "done",
  );
  const thoughts = browsing.filter(
    (i) => !i.start_time && i.status !== "done",
  );
  const done = browsing.filter((i) => i.status === "done");
  // Soft glance bucket — undated notes the user may reopen, not a warning.
  const glance = Math.min(2, thoughts.length);
  const taskish = Math.max(0, thoughts.length - glance);

  const tiles = [
    {
      key: "schedule",
      count: schedule.length,
      label: t("일정", "Schedule"),
      Icon: Clock,
    },
    {
      key: "task",
      count: taskish,
      label: t("할 일", "To-do"),
      Icon: Check,
    },
    {
      key: "thought",
      count: thoughts.length,
      label: t("생각", "Thought"),
      Icon: Pencil,
    },
    {
      key: "check",
      count: glance || done.length,
      label: t("확인 필요", "Worth a look"),
      Icon: HelpCircle,
    },
  ] as const;

  if (!open) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="84dvh"
      title={t("정리하기", "Organize")}
    >
      <div
        className="sheet-scroll px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
        data-testid="organize-summary-sheet"
      >
        <h2 className="quietly-hero-title mt-2 text-[28px]">
          {t("다 정리해뒀어요.", "All sorted for you.")}
        </h2>
        <p className="quietly-hero-sub mt-2">
          {t("필요한 곳만 열어보세요.", "Open only what you need.")}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {tiles.map(({ key, count, label, Icon }) => (
            <div
              key={key}
              className="quietly-feedback-card flex flex-col gap-2 px-4 py-4"
              data-testid={`organize-tile-${key}`}
            >
              <Icon size={18} className="text-ink-soft" aria-hidden />
              <p className="text-[32px] font-black tabular-nums leading-none tracking-[-0.04em] text-ink">
                {count}
              </p>
              <p className="text-[13px] font-semibold text-ink-soft">{label}</p>
            </div>
          ))}
        </div>

        {(schedule[0] || thoughts[0]) && (
          <section className="mt-7">
            <h3 className="quietly-section-label mb-2">
              {t("최근 정리 결과", "Recent results")}
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
              {thoughts[0] && (
                <div className="flex items-start gap-2.5 px-3 py-3">
                  <Pencil size={16} className="mt-0.5 text-ink-soft" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink">
                      {thoughts[0].text.trim() || t("(내용 없음)", "(No text)")}
                    </p>
                    <p className="mt-0.5 text-[12px] font-medium text-ink-soft">
                      {t("생각", "Thought")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </BottomSheet>
  );
}
