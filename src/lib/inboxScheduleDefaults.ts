import { detectDate } from "@/lib/dateDetect";
import { thoughtFirstLine } from "@/lib/brainMirror";
import {
  defaultEndFromStart,
  endOfDay,
  startOfDay,
} from "@/lib/scheduleChoices";
import type { ScheduleConfirmOptions } from "@/components/ScheduleChoiceFlow";
import type { InboxItem } from "@/lib/store";

const EXPLICIT_TIME_RE =
  /(?:오전|오후|아침|점심|저녁|밤|새벽|\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?|\b(?:morning|afternoon|evening|tonight|noon|midnight)\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b)/i;

export function hasExplicitScheduleTime(text: string): boolean {
  return EXPLICIT_TIME_RE.test(text.trim());
}

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
  const detected = detectDate(item.text);
  const dateOnly = Boolean(detected) && !hasExplicitScheduleTime(item.text);
  const start = dateOnly
    ? startOfDay(detected!.start)
    : defaultScheduleStart(item);
  const end = dateOnly ? endOfDay(start) : defaultEndFromStart(start);
  const text = thoughtFirstLine(item.text);
  const options: ScheduleConfirmOptions = {
    reminderMinutes: null,
    allDay: dateOnly,
    startAllDay: dateOnly,
    endAllDay: dateOnly,
    repeat: null,
  };
  return { start, end, text, options };
}
