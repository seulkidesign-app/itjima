import {
  parseCanonicalTemporalModel,
  type CanonicalTemporalModel,
} from "@/lib/nlTemporalCalendarModel";
import { isValidCalendarYmd } from "@/lib/nlCalendarValidity";

export type CanonicalTemporalCandidate = {
  start: Date;
  end: Date | null;
  precision: CanonicalTemporalModel["precision"];
};

const KO_WEEKDAY: Record<string, number> = {
  일: 0,
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6,
};

const EN_WEEKDAY: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function atStartOfDay(now: Date): Date {
  const value = new Date(now);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(now: Date, amount: number): Date {
  const value = atStartOfDay(now);
  value.setDate(value.getDate() + amount);
  return value;
}

function weekdayNumber(raw: string): number | null {
  const ko = raw.match(/(일|월|화|수|목|금|토)요일/);
  if (ko) return KO_WEEKDAY[ko[1]] ?? null;

  const en = raw.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (!en) return null;
  return EN_WEEKDAY[en[1].toLowerCase()] ?? null;
}

function resolveWeekday(raw: string, now: Date): Date | null {
  const target = weekdayNumber(raw);
  if (target === null) return null;

  const value = atStartOfDay(now);
  const delta = (target - value.getDay() + 7) % 7;
  value.setDate(value.getDate() + delta);
  return value;
}

function mondayOfWeek(now: Date): Date {
  const value = atStartOfDay(now);
  const daysSinceMonday = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - daysSinceMonday);
  return value;
}

function resolveScopedWeekday(
  raw: string,
  now: Date,
  weekOffset: 0 | 1,
): Date | null {
  const target = weekdayNumber(raw);
  if (target === null) return null;

  const monday = mondayOfWeek(now);
  monday.setDate(monday.getDate() + weekOffset * 7);
  const mondayBasedOffset = target === 0 ? 6 : target - 1;
  monday.setDate(monday.getDate() + mondayBasedOffset);
  return monday;
}

function resolveModelDate(
  model: CanonicalTemporalModel,
  now: Date,
): Date | null {
  const date = model.date;
  if (!date) return atStartOfDay(now);

  switch (date.kind) {
    case "today":
      return atStartOfDay(now);
    case "tomorrow":
      return addDays(now, 1);
    case "day_after_tomorrow":
      return addDays(now, 2);
    case "three_days_later":
      return addDays(now, 3);
    case "weekday":
      return resolveWeekday(date.raw, now);
    case "this_week_weekday":
      return resolveScopedWeekday(date.raw, now, 0);
    case "next_week_weekday":
      return resolveScopedWeekday(date.raw, now, 1);
    case "full_date": {
      const match = date.raw.match(
        /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/,
      );
      if (!match) return null;
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (!isValidCalendarYmd(year, month, day)) return null;
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    case "month_day": {
      const ko = date.raw.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
      const slash = date.raw.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
      const month = Number((ko ?? slash)?.[1]);
      const day = Number((ko ?? slash)?.[2]);
      if (!month || !day) return null;
      const year = now.getFullYear();
      if (
        !isValidCalendarYmd(year, month, day) &&
        !isValidCalendarYmd(year + 1, month, day)
      ) {
        return null;
      }
      // Prefer a leap-valid construction when Feb 29 rolls into next year.
      const baseYear = isValidCalendarYmd(year, month, day) ? year : year + 1;
      const value = new Date(baseYear, month - 1, day, 0, 0, 0, 0);
      if (
        baseYear === year &&
        value.getTime() < atStartOfDay(now).getTime()
      ) {
        if (!isValidCalendarYmd(year + 1, month, day)) return null;
        value.setFullYear(year + 1);
      }
      return value;
    }
    case "next_month_day": {
      const match = date.raw.match(/다음\s*달\s*(\d{1,2})\s*일/);
      if (!match) return null;
      return new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        Number(match[1]),
        0,
        0,
        0,
        0,
      );
    }
    default:
      return null;
  }
}

/**
 * Canonical timestamp candidate derived only from the Temporal Model.
 * This is intentionally non-authoritative until the migration gates promote it.
 */
export function resolveCanonicalTemporalCandidate(
  text: string,
  now = new Date(),
): CanonicalTemporalCandidate | null {
  const model = parseCanonicalTemporalModel(text, now);
  if (model.ambiguities.length > 0 || model.deadline || model.recurrence) {
    return null;
  }

  if (model.relativeOffset) {
    const unitMs =
      model.relativeOffset.unit === "minute"
        ? 60_000
        : model.relativeOffset.unit === "hour"
          ? 60 * 60_000
          : 24 * 60 * 60_000;
    return {
      start: new Date(now.getTime() + model.relativeOffset.amount * unitMs),
      end: null,
      precision: model.precision,
    };
  }

  const date = resolveModelDate(model, now);
  if (!date) return null;

  if (model.range?.supportedSyntax && model.range.resolved) {
    if (
      model.range.start?.kind !== "exact" ||
      model.range.end?.kind !== "exact"
    ) {
      return null;
    }
    const start = new Date(date);
    start.setHours(
      model.range.start.hour24,
      model.range.start.minute,
      0,
      0,
    );
    const end = new Date(date);
    end.setHours(model.range.end.hour24, model.range.end.minute, 0, 0);
    if (end.getTime() <= start.getTime()) return null;
    return { start, end, precision: model.precision };
  }

  if (!model.exactClock) return null;
  const start = new Date(date);
  start.setHours(model.exactClock.hour24, model.exactClock.minute, 0, 0);
  return { start, end: null, precision: model.precision };
}
