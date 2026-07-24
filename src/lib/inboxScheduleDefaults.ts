import { detectDate } from "@/lib/dateDetect";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { defaultEndFromStart } from "@/lib/scheduleChoices";
import type { ScheduleConfirmOptions } from "@/components/ScheduleChoiceFlow";
import type { InboxItem } from "@/lib/store";

/** Default schedule anchor when no sheet is shown (matches FocusScheduleSheet). */
export function defaultScheduleStart(item: InboxItem): Date {
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

export function inboxScheduleDefaults(item: InboxItem) {
  const start = defaultScheduleStart(item);
  const end = defaultEndFromStart(start);
  const text = thoughtFirstLine(item.text);
  const options: ScheduleConfirmOptions = {
    reminderMinutes: null,
    allDay: false,
    startAllDay: false,
    endAllDay: false,
    repeat: null,
  };
  return { start, end, text, options };
}
