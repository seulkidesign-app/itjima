export type ScheduleConfirmationReason =
  | "past_today"
  | "weekend_day"
  | "after_work_time"
  | "assumed_meridiem";

function parseMentionedTime(text: string): { hour: number; minute: number } | null {
  const ko = text.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  if (ko) {
    let hour = Number(ko[2]);
    const minute = ko[3] ? Number(ko[3]) : 0;
    if (ko[1] === "오후" && hour < 12) hour += 12;
    else if (ko[1] === "오전" && hour === 12) hour = 0;
    else if (!ko[1] && hour >= 1 && hour <= 6) hour += 12;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  const en = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (en) {
    let hour = Number(en[1]);
    const minute = en[2] ? Number(en[2]) : 0;
    if (en[3].toLowerCase() === "pm" && hour < 12) hour += 12;
    if (en[3].toLowerCase() === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }

  const clock24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return clock24
    ? { hour: Number(clock24[1]), minute: Number(clock24[2]) }
    : null;
}

function hasBareAfternoonGuess(text: string): boolean {
  for (const match of text.matchAll(/(\d{1,2})\s*시/g)) {
    const hour = Number(match[1]);
    if (hour < 1 || hour > 6) continue;
    const prefix = text.slice(Math.max(0, (match.index ?? 0) - 4), match.index);
    if (!/(오전|오후)\s*$/.test(prefix)) return true;
  }
  return false;
}

/**
 * Returns a reason when a parsed schedule contains a product assumption that
 * should be confirmed before one-tap creation.
 */
export function scheduleConfirmationReason(
  text: string,
  now = new Date(),
): ScheduleConfirmationReason | null {
  const trimmed = text.trim();

  if (/(오늘|\btoday\b)/i.test(trimmed)) {
    const time = parseMentionedTime(trimmed);
    if (time) {
      const mentioned = new Date(now);
      mentioned.setHours(time.hour, time.minute, 0, 0);
      if (mentioned.getTime() <= now.getTime()) return "past_today";
    }
  }

  if (/(주말|\bweekend\b)/i.test(trimmed)) return "weekend_day";
  if (/(퇴근\s*후|\bafter\s+work\b)/i.test(trimmed)) return "after_work_time";
  if (hasBareAfternoonGuess(trimmed)) return "assumed_meridiem";

  return null;
}
