import { useMemo } from "react";
import { BottomSheet } from "./BottomSheet";
import { useT, useLang } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";
import {
  findCleanupDuplicateGroups,
  type CleanupDuplicateGroup,
} from "@/lib/cleanupReview";
import { confirm as confirmHaptic } from "@/lib/haptics";

type Props = {
  items: InboxItem[];
  open: boolean;
  onClose: () => void;
  onConfirmDelete: (ids: string[]) => void | Promise<void>;
};

export function CleanupReviewSheet({
  items,
  open,
  onClose,
  onConfirmDelete,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const groups = useMemo(() => findCleanupDuplicateGroups(items), [items]);

  if (!open) return null;

  const deleteCopy = async (item: InboxItem) => {
    confirmHaptic();
    await onConfirmDelete([item.id]);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="85dvh"
      title={t("중복 기록 확인", "Review duplicates")}
    >
      <div
        className="sheet-scroll max-h-[85vh] overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
        data-testid="cleanup-review-sheet"
      >
        <h2 className="quietly-hero-title mt-2 text-[26px]">
          {groups.length > 0
            ? t("같은 내용이 보여요.", "I found matching notes.")
            : t("지금은 그대로 두면 돼요.", "Nothing needs reviewing right now.")}
        </h2>
        <p className="quietly-hero-sub mt-2">
          {groups.length > 0
            ? t(
                "자동으로 지우지 않아요. 둘 다 남겨도 괜찮고, 필요 없는 한 개만 직접 지울 수 있어요.",
                "Nothing is removed automatically. Keep both, or delete only the copy you do not need.",
              )
            : t(
                "오래됐거나 짧다는 이유만으로 기록을 정리 대상으로 보지 않아요.",
                "Old or short notes are never cleanup candidates just because of age or length.",
              )}
        </p>

        {groups.length > 0 ? (
          <div className="mt-6 space-y-4" data-testid="cleanup-duplicate-groups">
            {groups.map((group) => (
              <DuplicateGroupCard
                key={group.key}
                group={group}
                lang={lang}
                onDelete={deleteCopy}
              />
            ))}
          </div>
        ) : (
          <div
            className="quietly-feedback-card mt-6 px-4 py-5 text-sm leading-relaxed text-ink-soft"
            data-testid="cleanup-empty"
          >
            {t(
              "중복으로 확실히 확인되는 기록이 없어요. 따로 정리하지 않아도 됩니다.",
              "There are no clear exact duplicates. You do not need to clean anything up.",
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="touch-press mt-6 min-h-11 w-full rounded-full bg-ink/[0.06] px-4 py-3 text-[14px] font-semibold text-ink"
        >
          {t("닫기", "Done")}
        </button>
      </div>
    </BottomSheet>
  );
}

function DuplicateGroupCard({
  group,
  lang,
  onDelete,
}: {
  group: CleanupDuplicateGroup;
  lang: "ko" | "en";
  onDelete: (item: InboxItem) => void | Promise<void>;
}) {
  const t = useT();
  const locale = lang === "en" ? "en-US" : "ko-KR";

  return (
    <section
      className="quietly-feedback-card overflow-hidden"
      data-testid="cleanup-duplicate-group"
    >
      <div className="px-4 pb-2 pt-4">
        <p className="text-[12px] font-semibold text-ink-soft">
          {t("같은 내용의 기록", "Same text")}
        </p>
        <p className="mt-1 break-words text-[16px] font-semibold leading-snug text-ink">
          {group.items[0]?.text.trim()}
        </p>
      </div>

      <div className="divide-y divide-[var(--quietly-border)]">
        {group.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3"
            data-testid="cleanup-copy-row"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium tabular-nums text-ink-soft">
                {new Date(item.created_at).toLocaleString(locale, {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <button
              type="button"
              data-testid={`cleanup-delete-${item.id}`}
              onClick={() => void onDelete(item)}
              className="touch-press min-h-11 shrink-0 rounded-full px-3 text-[13px] font-semibold text-meta"
            >
              {t("이 기록 삭제", "Delete this copy")}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
