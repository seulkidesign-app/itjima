import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import {
  ScheduleChoiceFlow,
  type ScheduleConfirmOptions,
} from "./ScheduleChoiceFlow";
import type { InboxItem } from "@/lib/store";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { readCachedTimingExtra } from "@/lib/brainMirrorApi";
import { detectDate, resolveScheduleGuidanceReason } from "@/lib/dateDetect";

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

function defaultStart(item: InboxItem): Date {
  const det =
    detectDate(item.text) ??
    (item.brain_mirror?.suggestedDateText
      ? detectDate(item.brain_mirror.suggestedDateText)
      : null);
  if (det) return det.start;
  const d = new Date();
  d.setMinutes(0, 0, 0);
  if (d.getHours() < 9) d.setHours(9, 0, 0, 0);
  else if (d.getHours() >= 18) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export function FocusScheduleSheet({ item, open, onClose, onConfirm }: Props) {
  const [title, setTitle] = useState("");

  const guidanceReason = useMemo(() => {
    if (!item || !open) return null;
    return resolveScheduleGuidanceReason(readCachedTimingExtra(item.text));
  }, [item, open]);

  const initialStart = useMemo(
    () => (item ? defaultStart(item) : undefined),
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
