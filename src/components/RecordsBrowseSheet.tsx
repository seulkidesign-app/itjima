import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { OrganizeSummarySheet } from "./OrganizeSummarySheet";
import { useLang, useT } from "@/lib/i18n";
import {
  getAllBrowseEntries,
  searchAllBrowseEntries,
  type BrowseRecordEntry,
} from "@/lib/browseRecordModel";
import { formatCaptureWhenLabel } from "@/lib/naturalScheduleDraft";
import { replaceAllDayWithFuzzyDaypart } from "@/lib/temporalDisplay";
import type { InboxItem, ScheduleItem } from "@/lib/store";

/** Flat factual metadata. Missing date is not an error state and stays quiet. */
function browseWhenMeta(
  entry: BrowseRecordEntry,
  lang: "ko" | "en",
  t: ReturnType<typeof useT>,
): string | null {
  const done = entry.status === "done";
  if (done) {
    const created = new Date(entry.created_at).getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Number.isFinite(created)
      ? Math.max(0, Math.floor((Date.now() - created) / dayMs))
      : 0;
    if (days <= 0) return lang === "en" ? "Completed" : "완료";
    const ago =
      lang === "en"
        ? days === 1
          ? "1 day ago"
          : `${days} days ago`
        : `${days}일 전`;
    return `${ago} · ${lang === "en" ? "Completed" : "완료"}`;
  }

  if (entry.kind === "record" && entry.clarification_state === "pending") {
    return t("확인 필요", "Needs confirmation");
  }

  if (entry.start_time) {
    const base = formatCaptureWhenLabel(
      new Date(entry.start_time),
      Boolean(entry.all_day),
      lang,
    );
    if (
      entry.kind === "record" &&
      entry.temporal_state === "fuzzy_time"
    ) {
      return replaceAllDayWithFuzzyDaypart(
        base,
        entry.raw_text ?? entry.text,
        lang,
      );
    }
    if (entry.kind === "schedule" && entry.all_day) {
      return replaceAllDayWithFuzzyDaypart(
        base,
        entry.raw_text ?? entry.text,
        lang,
      );
    }
    return base;
  }

  return null;
}

type Props = {
  items: InboxItem[];
  schedules: ScheduleItem[];
  open: boolean;
  onClose: () => void;
  onOpenRecord: (item: InboxItem) => void;
  onOpenSchedule: (item: ScheduleItem) => void;
};

export function RecordsBrowseSheet({
  items,
  schedules,
  open,
  onClose,
  onOpenRecord,
  onOpenSchedule,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";
  const [query, setQuery] = useState("");
  const [organizeOpen, setOrganizeOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setOrganizeOpen(false);
    }
  }, [open]);

  const browsing = useMemo(
    () => getAllBrowseEntries(items, schedules),
    [items, schedules],
  );
  const results = useMemo(
    () => searchAllBrowseEntries(items, schedules, query),
    [items, schedules, query],
  );
  const isSearching = query.trim().length > 0;
  const emptySearch = isSearching && results.length === 0;
  const emptyAll = !isSearching && browsing.length === 0;

  if (!open) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight={organizeOpen ? "84dvh" : "78dvh"}
      title={organizeOpen ? t("정리하기", "Organize") : t("전체 기록", "All records")}
    >
      {organizeOpen ? (
        <OrganizeSummarySheet
          items={items}
          schedules={schedules}
          open
          embedded
          onClose={() => setOrganizeOpen(false)}
        />
      ) : (
        <div
          className="sheet-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          data-testid="records-browse-sheet"
        >
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="quietly-section-label">
              {t("최근 기록", "Recent records")}
            </p>
            <button
              type="button"
              data-testid="records-browse-organize"
              onClick={() => setOrganizeOpen(true)}
              className="touch-press inline-flex min-h-11 items-center rounded-full border border-[var(--quietly-border)] bg-white px-3 text-[12px] font-bold text-ink"
            >
              {t("정리하기", "Organize")}
            </button>
          </div>

          <label className="relative mt-3 block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("검색어를 입력하세요", "Enter a search term")}
              aria-label={t("기록 검색", "Search records")}
              data-testid="records-browse-search"
              className="w-full rounded-full border border-[var(--quietly-border)] bg-white py-3 pl-10 pr-4 text-[15px] text-ink shadow-[var(--shadow-input)] input-focus-ring"
            />
          </label>

          {emptyAll ? (
            <p
              className="mt-8 text-center text-[14px] text-ink-soft"
              data-testid="records-browse-empty"
            >
              {t("아직 남긴 기록이 없어요", "No records yet")}
            </p>
          ) : emptySearch ? (
            <div
              className="mt-10 flex flex-col items-center text-center"
              data-testid="records-browse-no-results"
            >
              <p className="text-[16px] font-bold text-ink">
                {t("검색 결과가 없어요.", "No search results.")}
              </p>
              <p className="mt-2 max-w-[16rem] text-[13px] leading-relaxed text-ink-soft">
                {t(
                  "다른 키워드로 검색하거나 오타를 확인해 보세요.",
                  "Try another keyword or check for typos.",
                )}
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="touch-press mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-[14px] font-bold text-ink"
              >
                {t("전체 기록 보기", "View all records")}
              </button>
            </div>
          ) : (
            <ul
              className="mt-3 flex flex-col"
              data-testid={
                isSearching
                  ? "records-browse-search-results"
                  : "records-browse-list"
              }
            >
              {results.map((entry) => {
                const done = entry.status === "done";
                const title =
                  entry.text.trim() || t("(내용 없음)", "(No text)");
                const meta = browseWhenMeta(entry, uiLang, t);
                return (
                  <li
                    key={`${entry.kind}:${entry.id}`}
                    className="quietly-record-row last:border-b-0"
                  >
                    <button
                      type="button"
                      data-testid="records-browse-row"
                      data-record-id={entry.canonicalId}
                      data-record-kind={entry.kind}
                      data-status={entry.status ?? "active"}
                      onClick={() => {
                        onClose();
                        if (entry.kind === "record") {
                          onOpenRecord(entry.record);
                        } else {
                          onOpenSchedule(entry.schedule);
                        }
                      }}
                      className="flex min-h-11 w-full items-start gap-2.5 px-1 py-3 text-left touch-press"
                    >
                      <span
                        className="quietly-record-dot mt-[6px]"
                        data-done={done ? "true" : "false"}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[15px] font-semibold leading-snug text-ink ${
                            done ? "text-ink-soft" : ""
                          }`}
                        >
                          {title}
                        </span>
                        {meta ? (
                          <span className="mt-1 block text-[12px] font-medium tabular-nums tracking-[-0.01em] text-ink-soft">
                            {meta}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
