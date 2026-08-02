import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "./BottomSheet";
import { ScheduleRangeChoiceFlow } from "./ScheduleRangeChoiceFlow";
import { useT, useLang } from "@/lib/i18n";
import { calmSuggestionReason } from "@/lib/dateDetect";
import type { RepeatRule } from "@/lib/store";
import {
  scheduleValidationMessage,
  validateScheduleRange,
} from "@/lib/scheduleValidation";

export type ScheduleSaveOptions = {
  allDay?: boolean;
  startAllDay?: boolean;
  endAllDay?: boolean;
  repeat?: RepeatRule | null;
  reminderMinutes?: number | null;
  /** @deprecated use reminderMinutes */
  alarmMinutesBefore?: number | null;
};

export function ScheduleSheet({
  open,
  initialText = "",
  initialStart,
  initialEnd,
  initialAllDay,
  initialStartAllDay,
  initialEndAllDay,
  initialRepeat,
  initialReminderKey,
  saveLabel,
  onClose,
  onSave,
}: {
  open: boolean;
  initialText?: string;
  initialStart?: Date;
  initialEnd?: Date;
  initialAllDay?: boolean;
  initialStartAllDay?: boolean;
  initialEndAllDay?: boolean;
  initialRepeat?: RepeatRule | null;
  initialReminderKey?: import("@/lib/scheduleChoices").ReminderKey;
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
  const { lang } = useLang();
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (!open) return;
    setText(initialText);
  }, [open, initialText]);

  const suggestionReason =
    !saveLabel && initialText.trim()
      ? calmSuggestionReason(initialText, lang === "en" ? "en" : "ko")
      : null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="92dvh"
      title={
        saveLabel
          ? t("일정 수정", "Edit schedule")
          : t("일정 추가", "Add schedule")
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
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
        <ScheduleRangeChoiceFlow
          open={open}
          title={text}
          onTitleChange={setText}
          initialStart={initialStart}
          suggestedStart={initialStart}
          suggestionReason={suggestionReason}
          initialEnd={initialEnd}
          initialAllDay={initialAllDay}
          initialStartAllDay={initialStartAllDay}
          initialEndAllDay={initialEndAllDay}
          initialRepeat={initialRepeat}
          editMode={!!saveLabel}
          initialReminderKey={initialReminderKey}
          onConfirm={(start, end, opts) => {
            const validation = validateScheduleRange(start, end, {
              editMode: Boolean(saveLabel),
            });
            if (!validation.ok) {
              toast.message(
                scheduleValidationMessage(
                  validation.reason,
                  lang === "en" ? "en" : "ko",
                ),
              );
              return;
            }
            onSave(
              text.trim() || t("새 일정", "New schedule"),
              start,
              end,
              opts,
            );
          }}
        />
      </div>
    </BottomSheet>
  );
}
