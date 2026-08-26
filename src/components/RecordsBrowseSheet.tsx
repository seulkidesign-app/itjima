import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { useT } from "@/lib/i18n";
import {
  getBrowsableRecords,
  searchCanonicalRecords,
} from "@/lib/canonicalBrowse";
import type { InboxItem } from "@/lib/store";

type Props = {
  items: InboxItem[];
  open: boolean;
  onClose: () => void;
  onOpenRecord: (item: InboxItem) => void;
};

export function RecordsBrowseSheet({
  items,
  open,
  onClose,
  onOpenRecord,
}: Props) {
  const t = useT();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const results = useMemo(
    () => searchCanonicalRecords(items, query),
    [items, query],
  );
  const browsing = useMemo(() => getBrowsableRecords(items), [items]);
  const isSearching = query.trim().length > 0;
  const emptySearch = isSearching && results.length === 0;
  const emptyAll = !isSearching && browsing.length === 0;

  if (!open) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="78dvh"
      title={t("전체 기록", "All records")}
    >
      <div
        className="sheet-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        data-testid="records-browse-sheet"
      >
        <label className="relative mt-1 block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("기록 검색", "Search records")}
            aria-label={t("기록 검색", "Search records")}
            data-testid="records-browse-search"
            className="w-full rounded-full border border-ink/10 bg-ink/[0.03] py-3 pl-10 pr-4 text-[15px] text-ink input-focus-ring"
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
          <p
            className="mt-8 text-center text-[14px] text-ink-soft"
            data-testid="records-browse-no-results"
          >
            {t("찾는 기록이 없어요", "No matching records")}
          </p>
        ) : (
          <ul
            className="mt-3 flex flex-col"
            data-testid={
              isSearching
                ? "records-browse-search-results"
                : "records-browse-list"
            }
          >
            {results.map((item) => {
              const done = item.status === "done";
              const title =
                item.text.trim() || t("(내용 없음)", "(No text)");
              return (
                <li key={item.id} className="border-b border-ink/[0.06] last:border-b-0">
                  <button
                    type="button"
                    data-testid="records-browse-row"
                    data-record-id={item.id}
                    data-status={item.status ?? "active"}
                    onClick={() => {
                      onClose();
                      onOpenRecord(item);
                    }}
                    className="flex min-h-11 w-full flex-col items-start gap-0.5 px-1 py-3 text-left touch-press"
                  >
                    <span
                      className={`text-[15px] font-semibold leading-snug text-ink ${
                        done ? "line-through decoration-ink/20" : ""
                      }`}
                    >
                      {title}
                    </span>
                    {done && (
                      <span className="text-[12px] font-medium text-ink-soft">
                        {t("완료", "Done")}
                      </span>
                    )}
                    {item.start_time && (
                      <span className="text-[12px] font-medium text-ink-soft">
                        {t("일정 있음", "On schedule")}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}
