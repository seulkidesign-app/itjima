import {
  Archive,
  Calendar,
  Copy,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "./BottomSheet";
import { useT } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
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

function ActionRow({
  icon,
  label,
  description,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3.5 rounded-[20px] px-3 py-3.5 text-left active:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/30 ${
        danger ? "text-meta" : "text-ink"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-ink/[0.04]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold tracking-[-0.01em]">{label}</div>
        <div className="mt-0.5 text-[13px] leading-snug text-ink-soft">
          {description}
        </div>
      </div>
    </button>
  );
}

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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open || !item) return;
    setEditing(false);
    setDraft(item.text);
  }, [open, item]);

  if (!item) return null;

  const hasTemporal = Boolean(item.start_time);

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
      maxHeight="72dvh"
      title={t("이 생각", "This thought")}
    >
      <div className="sheet-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {editing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              className="mt-1 w-full resize-none rounded-[20px] bg-ink/[0.03] px-4 py-3 text-[15px] leading-relaxed text-ink input-focus-ring"
              aria-label={t("생각 수정", "Edit thought")}
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-full border border-ink/10 py-3 text-sm font-semibold text-ink-soft"
              >
                {t("취소", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-ink"
              >
                {t("반영하기", "Save changes")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 whitespace-pre-wrap rounded-[20px] bg-ink/[0.025] px-4 py-4 text-[15px] leading-relaxed text-ink">
              {item.text.trim() || t("사진만 있어요", "Photo only")}
            </p>
            <div className="mt-3 flex flex-col gap-0.5">
              <ActionRow
                icon={<Calendar size={18} strokeWidth={2} />}
                label={
                  hasTemporal
                    ? t("일정 바꾸기", "Change schedule")
                    : t("일정으로 보내기", "Send to schedule")
                }
                description={t("언제 다시 떠올릴까요?", "When should we bring it back?")}
                onClick={() => {
                  tap();
                  onClose();
                  onSchedule(item);
                }}
              />
              {hasTemporal && onClearTemporal && (
                <ActionRow
                  icon={<Calendar size={18} strokeWidth={2} />}
                  label={t("날짜·시간 지우기", "Remove date & time")}
                  description={t(
                    "기록은 남기고 일정만 없애요",
                    "Keep the record, drop only the schedule",
                  )}
                  onClick={() => {
                    tap();
                    onClose();
                    void onClearTemporal(item);
                  }}
                />
              )}
              <ActionRow
                icon={<Archive size={18} strokeWidth={2} />}
                label={t("보관하기", "Save to vault")}
                description={t("나중에 다시 꺼낼 수 있어요", "You can pull it out later")}
                onClick={() => {
                  tap();
                  onClose();
                  onArchive(item);
                }}
              />
              <ActionRow
                icon={<Pencil size={18} strokeWidth={2} />}
                label={t("수정하기", "Edit")}
                description={t("고치고 싶을 때", "When you want to tweak it")}
                onClick={() => {
                  tap();
                  setEditing(true);
                }}
              />
              <ActionRow
                icon={<Copy size={18} strokeWidth={2} />}
                label={t("복사하기", "Copy")}
                description={t("다른 곳에 붙여 넣기", "Paste somewhere else")}
                onClick={() => {
                  tap();
                  void copyText();
                }}
              />
              <ActionRow
                icon={<Trash2 size={18} strokeWidth={2} />}
                label={t("삭제하기", "Delete")}
                description={t("5초 안이면 되돌릴 수 있어요", "You have 5 seconds to undo")}
                danger
                onClick={() => {
                  tap();
                  onClose();
                  onDelete(item);
                }}
              />
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
