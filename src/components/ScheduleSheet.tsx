import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { ScheduleChoiceFlow } from "./ScheduleChoiceFlow";
import { useT } from "@/lib/i18n";
import type { RepeatRule } from "@/lib/store";

export type ScheduleSaveOptions = {
  allDay?: boolean;
  repeat?: RepeatRule | null;
  alarmMinutesBefore?: number | null;
};

export function ScheduleSheet({
  open,
  initialText = "",
  initialStart,
  initialAllDay,
  initialRepeat,
  saveLabel,
  onClose,
  onSave,
}: {
  open: boolean;
  initialText?: string;
  initialStart?: Date;
  initialEnd?: Date;
  initialAllDay?: boolean;
  initialRepeat?: RepeatRule | null;
  saveLabel?: string;
  onClose: () => void;
  onSave: (
    text: string,
    start: Date,
    end: Date,
    opts?: ScheduleSaveOptions,
  ) => void;
}) {
  const t = useT();
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (!open) return;
    setText(initialText);
  }, [open, initialText]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="85vh"
      title={saveLabel ? t("그때 수정", "Edit when") : t("그때 남기기", "Remember for then")}
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex shrink-0 items-center justify-end px-5 pb-1">
          <button
            type="button"
            onClick={onClose}
            className="touch-target rounded-full text-ink-soft active:bg-ink/5 active:text-ink"
            aria-label={t("닫기", "Close")}
          >
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ScheduleChoiceFlow
            open={open}
            title={text}
            onTitleChange={setText}
            initialStart={initialStart}
            editMode={!!saveLabel}
            onConfirm={(start, end, reminderMinutes) => {
              onSave(text.trim() || t("그때", "When"), start, end, {
                allDay: initialAllDay ?? false,
                repeat: initialRepeat ?? null,
                alarmMinutesBefore: reminderMinutes,
              });
            }}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
