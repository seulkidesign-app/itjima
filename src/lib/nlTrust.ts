export type ScheduleTrustIssue = "invalid_datetime" | "broad_daypart";

const KO_NUMBER: Record<string, number> = {
  한: 1,
  두: 2,
  세: 3,
  네: 4,
};

function numberValue(raw: string): number | null {
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  return KO_NUMBER[raw] ?? null;
}

function normalizeKoreanCompoundOffset(text: string): string {
  return text.replace(
    /(\d+|한|두|세|네)\s*시간\s*(?:(반)|(\d{1,2})\s*분)\s*(뒤|후)/g,
    (match, rawHours: string, half: string | undefined, rawMinutes: string | undefined, suffix: string) => {
      const hours = numberValue(rawHours);
      const minutes = half ? 30 : Number(rawMinutes);
      if (hours === null || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
        return match;
      }
      return `${hours * 60 + minutes}분 ${suffix}`;
    },
  );
}

function normalizeKoreanDaypartClock(text: string): string {
  return text.replace(
    /(오전|오후|아침|점심|저녁|밤|새벽)\s*(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/g,
    (match, part: string, rawHour: string, half?: string, rawMinute?: string) => {
      const hour = Number(rawHour);
      const minute = half === "반" ? 30 : rawMinute ? Number(rawMinute) : 0;
      if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return match;

      let period: "오전" | "오후";
      if (part === "오전" || part === "아침" || part === "새벽") {
        period = "오전";
      } else if (part === "밤") {
        // 밤 10시/11시는 PM, 밤 12시/1~5시는 자정 이후로 해석한다.
        period = hour >= 6 && hour <= 11 ? "오후" : "오전";
      } else {
        period = "오후";
      }

      const minuteLabel = half === "반" ? " 반" : rawMinute ? ` ${rawMinute}분` : "";
      return `${period} ${rawHour}시${minuteLabel}`;
    },
  );
}

/**
 * Normalize phrases that are semantically clear before they enter the older
 * deterministic parser. This keeps the hot path cheap while preventing common
 * Korean daypart/relative-time phrases from being interpreted as the wrong clock.
 */
export function normalizeScheduleInputForTrust(text: string): string {
  return normalizeKoreanDaypartClock(normalizeKoreanCompoundOffset(text.trim()));
}

function daysInMonth(year: number, monthOneBased: number): number {
  return new Date(year, monthOneBased, 0).getDate();
}

function isValidMonthDay(month: number, day: number, now: Date): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  let year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (month < currentMonth || (month === currentMonth && day < now.getDate())) {
    year += 1;
  }
  return day <= daysInMonth(year, month);
}

function hasInvalidDate(text: string, now: Date): boolean {
  const nextMonth = text.match(/다음\s*달\s*(\d{1,2})\s*일/);
  if (nextMonth) {
    const day = Number(nextMonth[1]);
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return day < 1 || day > daysInMonth(next.getFullYear(), next.getMonth() + 1);
  }

  const ko = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (ko) return !isValidMonthDay(Number(ko[1]), Number(ko[2]), now);

  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (slash) return !isValidMonthDay(Number(slash[1]), Number(slash[2]), now);

  return false;
}

function hasInvalidClock(text: string): boolean {
  const koContextual = text.match(
    /(오전|오후|아침|점심|저녁|밤|새벽)\s*(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/,
  );
  if (koContextual) {
    const hour = Number(koContextual[2]);
    const minute = koContextual[3] === "반" ? 30 : koContextual[4] ? Number(koContextual[4]) : 0;
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return true;
  }

  for (const match of text.matchAll(
    /(?<!오전\s|오후\s|아침\s|점심\s|저녁\s|밤\s|새벽\s)(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/g,
  )) {
    const hour = Number(match[1]);
    const minute = match[2] === "반" ? 30 : match[3] ? Number(match[3]) : 0;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return true;
  }

  const en = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (en) {
    const hour = Number(en[1]);
    const minute = en[2] ? Number(en[2]) : 0;
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return true;
  }

  const clock24 = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (clock24) {
    const hour = Number(clock24[1]);
    const minute = Number(clock24[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return true;
  }

  const compoundOffset = text.match(
    /(\d+|한|두|세|네)\s*시간\s*(?:반|(\d{1,2})\s*분)\s*(?:뒤|후)/,
  );
  if (compoundOffset?.[2] && Number(compoundOffset[2]) > 59) return true;

  return false;
}

function hasBroadDaypartWithoutClock(text: string): boolean {
  const hasDaypart =
    /(?:아침|점심|저녁|밤|새벽|\bmorning\b|\bafternoon\b|\bevening\b|\btonight\b|\bnoon\b|\bmidnight\b)/i.test(
      text,
    );
  if (!hasDaypart) return false;

  const hasNumericClock =
    /(?:\d{1,2}\s*시|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b)/i.test(
      text,
    );
  return !hasNumericClock;
}

/** Safety issue that must prevent silent schedule creation. */
export function scheduleTrustIssue(
  text: string,
  now = new Date(),
): ScheduleTrustIssue | null {
  const trimmed = text.trim();
  if (hasInvalidDate(trimmed, now) || hasInvalidClock(trimmed)) {
    return "invalid_datetime";
  }
  if (hasBroadDaypartWithoutClock(trimmed)) return "broad_daypart";
  return null;
}
