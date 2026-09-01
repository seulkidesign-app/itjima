import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "./BottomSheet";
import { useLang, useT } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { formatCaptureWhenLabel } from "@/lib/naturalScheduleDraft";
import { replaceAllDayWithFuzzyDaypart } from "@/lib/temporalDisplay";
import type { InboxItem } from "@/lib/store";

type Props = {
  item: InboxItem | null;
  open: boolean;
  onClose: () => void;
  onSchedule: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void;
  onDelete: (item: InboxItem) => void;
  onSaveEdit: (item: InboxItem, text: string) => void | Promise<void>;
  /** Clear datetime without deleting the record (timed only). */
  onClearTemporal?: (item: InboxItem) => void | Promise<void>;
};

function StackButton({
  label,
  onClick,
  danger,
  primary,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-press flex min-h-12 w-full items-center justify-center rounded-[16px] border px-4 text-[15px] font-semibold ${
        danger
          ? "border-[var(--quietly-border)] bg-white text-[var(--semantic-danger,#e5484d)]"
          : primary
            ? "border-transparent bg-primary text-ink"
            : "border-[var(--quietly-border)] bg-white text-ink"
      }`}
    >
      {label}
    </button>
  );
}

/** Shared record detail — Figma 319:2 Screens 14–15 (no Schedule-only detail). */
export function ThoughtDetailSheet({
  item,
  open,
  onClose,
  onSchedule,
  onArchive,
  onDelete,
  onSaveEdit,
  onClearTemporal,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open || !item) return;
    setEditing(false);
    setDraft(item.text);
  }, [open, item]);

  if (!item) return null;

  const hasTemporal = Boolean(item.start_time);
  const title =
    item.text.trim().split("\n")[0]?.trim() ||
    t("사진만 있어요", "Photo only");
  const baseWhenLabel =
    hasTemporal && item.start_time
      ? formatCaptureWhenLabel(
          new Date(item.start_time),
          Boolean(item.all_day),
          uiLang,
        )
      : t("날짜 없음", "No date");
  const whenLabel =
    hasTemporal && item.temporal_state === "fuzzy_time"
      ? replaceAllDayWithFuzzyDaypart(
          baseWhenLabel,
          item.raw_text ?? item.text,
          uiLang,
        )
      : baseWhenLabel;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(item.text);
      toast.success(t("복사해 뒀어요", "Copied for you"));
      onClose();
    } catch {
      toast.error(t("복사가 안 됐어요", "Couldn't copy that"));
    }
  };

  const saveEdit = async () => {
    const next = draft.trim();
    if (!next) {
      toast.error(t("뭐라도 적어 주세요", "Write something first"));
      return;
    }
    await onSaveEdit(item, next);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="78dvh"
      title={t("기록 상세", "Record detail")}
    >
      <div
        className="sheet-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        data-testid="thought-detail-sheet"
        data-has-temporal={hasTemporal ? "true" : "false"}
      >
        {editing ? (
          <>
            <p className="quietly-section-label mt-1">
              {t("내용 수정", "Edit content")}
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="mt-3 w-full resize-none rounded-[16px] border border-[var(--quietly-border)] bg-white px-4 py-3 text-[15px] leading-relaxed text-ink input-focus-ring"
              aria-label={t("생각 수정", "Edit thought")}
            />
            <div className="mt-4 flex flex-col gap-2">
              <StackButton
                label={t("반영하기", "Save changes")}
                primary
                onClick={() => void saveEdit()}
              />
              <StackButton
                label={t("취소", "Cancel")}
                onClick={() => setEditing(false)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="quietly-feedback-card mt-1 px-4 py-4">
              <p className="whitespace-pre-wrap text-[18px] font-bold leading-snug tracking-[-0.02em] text-ink">
                {title}
              </p>
              <p
                data-testid="thought-detail-when"
                className={`mt-2 text-[13px] font-semibold tabular-nums tracking-[-0.01em] ${
                  hasTemporal ? "text-primary" : "text-ink-soft"
                }`}
              >
                {whenLabel}
              </p>
            </div>

            {hasTemporal ? (
              <p className="mt-3 px-1 text-[13px] font-medium leading-snug text-ink-soft">
                {t("일정에도 함께 보여요", "Also shown in Schedule")}
              </p>
            ) : (
              <p className="mt-3 px-1 text-[13px] font-medium leading-snug text-ink-soft">
                {t(
                  "날짜를 추가하면 일정에서도 볼 수 있어요.",
                  "Add a date to also see it in Schedule.",
                )}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <StackButton
                label={
                  hasTemporal
                    ? t("시간 수정", "Change time")
                    : t("날짜/시간 추가", "Add date/time")
                }
                onClick={() => {
                  tap();
                  onClose();
                  onSchedule(item);
                }}
              />
              {hasTemporal && onClearTemporal ? (
                <StackButton
                  label={t("날짜·시간 지우기", "Remove date & time")}
                  onClick={() => {
                    tap();
                    onClose();
                    void onClearTemporal(item);
                  }}
                />
              ) : null}
              <StackButton
                label={t("수정하기", "Edit")}
                onClick={() => {
                  tap();
                  setEditing(true);
                }}
              />
              <StackButton
                label={t("기록 삭제", "Delete record")}
                danger
                onClick={() => {
                  tap();
                  onClose();
                  onDelete(item);
                }}
              />
            </div>

            <div className="mt-3 flex gap-2 px-0.5">
              {!hasTemporal && (
                <button
                  type="button"
                  onClick={() => {
                    tap();
                    onClose();
                    onArchive(item);
                  }}
                  className="touch-press min-h-11 flex-1 text-left text-[13px] font-medium text-ink-soft underline-offset-2 hover:underline"
                >
                  {t("보관하기", "Save to vault")}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  tap();
                  void copyText();
                }}
                className={`touch-press min-h-11 flex-1 text-[13px] font-medium text-ink-soft underline-offset-2 hover:underline ${
                  hasTemporal ? "text-left" : "text-right"
                }`}
              >
                {t("복사하기", "Copy")}
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
