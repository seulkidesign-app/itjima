/**
 * Calendar validity for NL schedule dates.
 * Reject invalid Y/M/D before JavaScript Date rollover can invent a day.
 */

export function isValidCalendarYmd(
  year: number,
  month: number,
  day: number,
): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const probe = new Date(year, month - 1, day);
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  );
}

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  return new Date(year, month, 0).getDate();
}

/** True when the utterance contains an absolute calendar date that cannot exist. */
export function hasInvalidCalendarDateExpression(text: string): boolean {
  const value = text.trim();
  if (!value) return false;

  for (const match of value.matchAll(
    /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g,
  )) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!isValidCalendarYmd(year, month, day)) return true;
  }

  // Month-day without year: reject days that never exist (Feb 29 allowed — leap).
  for (const match of value.matchAll(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    if (month < 1 || month > 12 || day < 1) return true;
    if (month === 2 && day === 29) continue;
    if (day > Math.max(daysInMonth(2027, month), daysInMonth(2028, month))) {
      return true;
    }
  }

  for (const match of value.matchAll(/\b(\d{1,2})[/-](\d{1,2})\b/g)) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    if (month < 1 || month > 12 || day < 1) return true;
    if (month === 2 && day === 29) continue;
    if (day > Math.max(daysInMonth(2027, month), daysInMonth(2028, month))) {
      return true;
    }
  }

  return false;
}
