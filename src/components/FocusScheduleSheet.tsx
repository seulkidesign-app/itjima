import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "./BottomSheet";
import {
  ScheduleChoiceFlow,
  type ScheduleConfirmOptions,
} from "./ScheduleChoiceFlow";
import type { InboxItem } from "@/lib/store";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { readCachedTimingExtra } from "@/lib/brainMirrorApi";
import { resolveScheduleGuidanceReason } from "@/lib/dateDetect";
import {
  defaultScheduleStart,
  readInboxScheduleDraft,
} from "@/lib/inboxScheduleDefaults";
import type { ReminderKey } from "@/lib/scheduleChoices";
import { useLang } from "@/lib/i18n";
import {
  scheduleValidationMessage,
  validateScheduleRange,
} from "@/lib/scheduleValidation";

type Props = {
  item: InboxItem | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (
    text: string,
    start: Date,
    end: Date,
    options: ScheduleConfirmOptions,
  ) => void;
};

function reminderKeyFromMinutes(minutes: number | null): ReminderKey {
  if (minutes === null) return "off";
  if (minutes === 0) return "at";
  if (minutes === 5) return "5m";
  if (minutes === 10) return "10m";
  if (minutes === 30) return "30m";
  if (minutes === 60) return "1h";
  if (minutes === 120) return "2h";
  if (minutes === 24 * 60) return "1d";
  return "off";
}

export function FocusScheduleSheet({ item, open, onClose, onConfirm }: Props) {
  const [title, setTitle] = useState("");
  const { lang } = useLang();

  const interpretedDraft = useMemo(
    () => (item && open ? readInboxScheduleDraft(item) : null),
    [item, open],
  );

  const guidanceReason = useMemo(() => {
    if (!item || !open || interpretedDraft) return null;
    return resolveScheduleGuidanceReason(readCachedTimingExtra(item.text));
  }, [item, open, interpretedDraft]);

  const initialStart = useMemo(
    () =>
      interpretedDraft?.start ?? (item ? defaultScheduleStart(item) : undefined),
    [item, interpretedDraft],
  );

  useEffect(() => {
    if (!open || !item) return;
    setTitle(interpretedDraft?.text ?? thoughtFirstLine(item.text));
  }, [open, item, interpretedDraft]);

  if (!item) return null;

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="88dvh">
      <ScheduleChoiceFlow
        open={open}
        title={title}
        onTitleChange={setTitle}
        thoughtText={item.text}
        guidanceReason={guidanceReason}
        initialStart={initialStart}
        initialEnd={interpretedDraft?.end}
        initialAllDay={interpretedDraft?.options.allDay}
        initialStartAllDay={interpretedDraft?.options.startAllDay}
        initialEndAllDay={interpretedDraft?.options.endAllDay}
        initialRepeat={interpretedDraft?.options.repeat}
        initialReminderKey={
          interpretedDraft
            ? reminderKeyFromMinutes(interpretedDraft.options.reminderMinutes)
            : undefined
        }
        onConfirm={(start, end, options) => {
          const validation = validateScheduleRange(start, end);
          if (!validation.ok) {
            toast.message(
              scheduleValidationMessage(
                validation.reason,
                lang === "en" ? "en" : "ko",
              ),
            );
            return;
          }
          onConfirm(
            title.trim() || interpretedDraft?.text || thoughtFirstLine(item.text),
            start,
            end,
            options,
          );
        }}
      />
    </BottomSheet>
  );
}
