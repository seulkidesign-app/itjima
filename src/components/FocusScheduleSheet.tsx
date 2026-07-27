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
import { detectDate, resolveScheduleGuidanceReason } from "@/lib/dateDetect";
import { defaultScheduleStart } from "@/lib/inboxScheduleDefaults";
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

export function FocusScheduleSheet({ item, open, onClose, onConfirm }: Props) {
  const [title, setTitle] = useState("");
  const { lang } = useLang();

  const guidanceReason = useMemo(() => {
    if (!item || !open) return null;
    return resolveScheduleGuidanceReason(readCachedTimingExtra(item.text));
  }, [item, open]);

  const initialStart = useMemo(
    () => (item ? defaultScheduleStart(item) : undefined),
    [item],
  );

  useEffect(() => {
    if (!open || !item) return;
    setTitle(thoughtFirstLine(item.text));
  }, [open, item]);

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
            title.trim() || thoughtFirstLine(item.text),
            start,
            end,
            options,
          );
        }}
      />
    </BottomSheet>
  );
}
