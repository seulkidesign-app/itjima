import { normalizeKoreanClockWordsForParsing } from "@/lib/nlKoreanTemporalNormalization";
import {
  parseNlTemporalModel,
  type NlTemporalModel,
  type TemporalDateKind,
} from "@/lib/nlTemporalModel";

export type CanonicalTemporalDateKind =
  | TemporalDateKind
  | "this_week_weekday"
  | "next_week_weekday";

export type CanonicalTemporalDate = {
  kind: CanonicalTemporalDateKind;
  raw: string;
};

export type CanonicalTemporalModel = Omit<NlTemporalModel, "date"> & {
  date: CanonicalTemporalDate | null;
};

const KO_SCOPED_WEEKDAY_RE =
  /(?:이번\s*주|다음\s*주)\s*(?:의\s*)?(?:일|월|화|수|목|금|토)요일/;
const EN_THIS_WEEK_WEEKDAY_RE =
  /\bthis\s+week\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
const EN_NEXT_WEEK_WEEKDAY_RE =
  /\bnext\s+week\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
const EN_DIRECT_NEXT_WEEKDAY_RE =
  /\bnext\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;

function parseScopedWeekdayDate(text: string): CanonicalTemporalDate | null {
  const ko = text.match(KO_SCOPED_WEEKDAY_RE);
  if (ko) {
    return {
      kind: /^다음\s*주/.test(ko[0])
        ? "next_week_weekday"
        : "this_week_weekday",
      raw: ko[0],
    };
  }

  const enNextWeek = text.match(EN_NEXT_WEEK_WEEKDAY_RE);
  if (enNextWeek) {
    return { kind: "next_week_weekday", raw: enNextWeek[0] };
  }

  const enThisWeek = text.match(EN_THIS_WEEK_WEEKDAY_RE);
  if (enThisWeek) {
    return { kind: "this_week_weekday", raw: enThisWeek[0] };
  }

  const enDirectNext = text.match(EN_DIRECT_NEXT_WEEKDAY_RE);
  if (enDirectNext) {
    return { kind: "next_week_weekday", raw: enDirectNext[0] };
  }

  return null;
}

/**
 * Canonical temporal model used by migration/resolution gates. Spoken Korean
 * clock words are normalized only for parsing; the user's durable raw record is
 * never rewritten by this layer.
 */
export function parseCanonicalTemporalModel(
  text: string,
  now = new Date(),
): CanonicalTemporalModel {
  const normalized = normalizeKoreanClockWordsForParsing(text);
  const base = parseNlTemporalModel(normalized, now);

  if (base.date?.kind === "weekday") {
    const scopedDate = parseScopedWeekdayDate(normalized);
    if (scopedDate) {
      return { ...base, date: scopedDate };
    }
  }

  return base as CanonicalTemporalModel;
}
