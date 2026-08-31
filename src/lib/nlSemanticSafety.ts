const NEGATION_RE =
  /(?:안\s*(?:가|해|하|할|갈|먹|만나)|못\s*가|하지\s*말|하지\s*않|않\s*(?:가|해|하)|없(?:음|어|다|습니다)|없어짐|없어졌|취소(?:됐|됨|해|할|됐어)?|\bno\s+meeting\b|\bnot\s+going\b|cancel(?:led|ed)?)/i;

const RETRIEVAL_QUESTION_RE =
  /(?:\?|뭐지|뭐\s*였|뭐\s*있(?:어|지|나)?|뭐\s*했|몇\s*시(?:였|야|지)|일정\s*(?:뭐|있(?:나|어|지)|보여|알려)|스케줄\s*(?:뭐|보여|알려)|(?:일정|스케줄).*보여\s*줘|맞아|what\s+do\s+i\s+have|do\s+i\s+have(?:\s+anything)?)/i;

const TENTATIVE_RE =
  /(?:갈까|할까|먹을까|만날까|갈지도|할지도|일지도|것\s*같|수도\s*있|잡을\s*듯|할\s*듯|갈\s*듯|아마|maybe|might|could|possibly|probably)/i;

const EDIT_COMMAND_RE =
  /(?:\b아니\b|아니\s+.*말고|\d{1,2}\s*시\s*말고|(?:내일|오늘|모레)\s*말고|(?:바꿔|바꾸|변경(?:해|하기|으로)?|일정\s*삭제|일정\s*취소|그거\s*(?:취소|삭제)|아까\s*일정)|(?:오전|오후)\s*\d{1,2}\s*시(?:\s*반|\s*\d{1,2}\s*분)?\s*로\s*$|^(?:오전|오후)\s*(?:이야|야)\s*$)/i;

const CONDITION_TRIGGER_RE =
  /(?:도착하면|도착할\s*때|\b가면\b|만나면|오면|나갈\s*때|들어가면|비\s*오면|눈\s*오면|날씨\s*좋으면|미세먼지.*괜찮으면|when\s+(?:i|we)\s+(?:arrive|meet|get|go)|if\s+(?:it\s+)?(?:rains|snows))/i;

const VAGUE_FUTURE_RE =
  /(?:나중에|언젠가|조만간|\b곧\b|기회\s*되면|시간\s*(?:되면|날\s*때)|틈날\s*때|생각날\s*때|sometime|later\b|when\s+i\s+have\s+time|when\s+possible)/i;

const PAST_WORD_RE =
  /(?:어제|그제|지난\s*주|지난주|지난\s*달|지난달|작년|yesterday|last\s+week|last\s+month|last\s+year)/i;

const SPECIFIC_WEEKDAY_RE =
  /(?:일|월|화|수|목|금|토)요일|\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;

const SPECIFIC_MONTH_DAY_RE =
  /(?:\d{1,2}\s*월\s*\d{1,2}\s*일|\b\d{1,2}[/-]\d{1,2}\b|\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일)/i;

const BROAD_MONTH_RE =
  /(?:이번\s*달|다음\s*달|\d{1,2}\s*월\s*(?:에|초|중순|말)(?!\s*\d{1,2}\s*일)|this\s+month|next\s+month|early\s+next\s+month|mid(?:dle)?\s+of\s+\w+|end\s+of\s+\w+)/i;

const DATE_RANGE_RE =
  /(?:(?:오늘|내일|모레|(?:일|월|화|수|목|금|토)요일|\d{1,2}\s*월\s*\d{1,2}\s*일|\b\d{1,2}[/-]\d{1,2}\b)\s*부터\s*(?:오늘|내일|모레|(?:일|월|화|수|목|금|토)요일|\d{1,2}\s*월\s*\d{1,2}\s*일|\b\d{1,2}[/-]\d{1,2}\b)\s*까지)|(?:\d+\s*일|일주일|한\s*주)\s*동안|(?:이번|다음)\s*주\s*내내/i;

const EXPANDED_REPEAT_RE =
  /(?:매일|매일마다|매주|매주마다|매월|매달|매년|해마다|(?:일|월|화|수|목|금|토)요일마다|(?:일|월|화|수|목|금|토)요일(?:\s+(?:일|월|화|수|목|금|토)요일)+마다|이틀에\s*한\s*번|\d+\s*일마다|격주|\d+\s*주마다|every\s+(?:day|week|month|year)|every\s+other\s+week|every\s+\d+\s+(?:days?|weeks?)|daily|weekly|monthly|yearly|annually)/i;

const MIXED_KO_MERIDIEM_COLON_RE = /(?:오전|오후)\s*\d{1,2}:[0-5]\d/i;
const COLON_CLOCK_RE = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g;
const DATE_ANCHOR_RE =
  /(?:오늘|내일|모레|글피|어제|그제|지난\s*주|이번\s*주|다음\s*주|다다음\s*주|(?:일|월|화|수|목|금|토)요일|\d{1,2}\s*월\s*\d{1,2}\s*일|\b\d{1,2}[/-]\d{1,2}\b|\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일|today|tomorrow|yesterday|next\s+week|this\s+week|last\s+week|\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b)/i;

/** Supported single-event from–to clock ranges (not deadlines). */
const KO_CLOCK_RANGE_RE =
  /(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*부터\s*(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?\s*까지/;

const DEADLINE_RE =
  /(?:까지|전까지|(?:^|[\s,，])by\s+\w|deadline|\bdue\b)/i;

export type QuietScheduleSemanticReason =
  | "negation"
  | "retrieval_question"
  | "tentative"
  | "edit_command"
  | "condition_trigger"
  | "vague_future";

export function quietScheduleSemanticReason(
  text: string,
): QuietScheduleSemanticReason | null {
  const value = text.trim();
  if (!value) return null;
  if (NEGATION_RE.test(value)) return "negation";
  if (RETRIEVAL_QUESTION_RE.test(value)) return "retrieval_question";
  if (TENTATIVE_RE.test(value)) return "tentative";
  if (EDIT_COMMAND_RE.test(value)) return "edit_command";
  if (CONDITION_TRIGGER_RE.test(value)) return "condition_trigger";
  if (VAGUE_FUTURE_RE.test(value)) return "vague_future";
  return null;
}

export function shouldKeepScheduleSemanticsQuiet(text: string): boolean {
  return quietScheduleSemanticReason(text) !== null;
}

/**
 * A period word plus a clock still does not identify a calendar day.
 * Weekend / 주말 stay out of this gate — existing weekend ambiguity owns them.
 * "this week" must not match inside "this weekend"; "이번 주" must not swallow "이번 주말".
 */
export function hasBroadUnresolvedDatePeriod(text: string): boolean {
  const value = text.trim();

  if (/다다음\s*주|week\s+after\s+next/i.test(value)) return true;

  // Negative lookahead keeps 주말 / weekend under the weekend clarification flow.
  const broadWeek =
    /(?:이번|다음)\s*주(?!\s*말)/i.test(value) ||
    /\b(?:this|next)\s+week(?!\s*end\b)/i.test(value);
  if (broadWeek && !SPECIFIC_WEEKDAY_RE.test(value)) return true;

  if (BROAD_MONTH_RE.test(value) && !SPECIFIC_MONTH_DAY_RE.test(value)) return true;
  return false;
}

/**
 * Fuzzy / approximate clock language. Production has no approximate-time model,
 * so these must never promote to an exact start (or an exact-looking promise).
 * Only time-bound hedges — bare "정도" alone is not enough.
 */
export function hasApproximateTimeExpression(text: string): boolean {
  const value = text.trim();
  if (!value) return false;

  if (
    /(?:오전|오후)?\s*\d{1,2}\s*시(?:\s*반|(?:\s*\d{1,2}\s*분))?\s*(?:쯤|경|무렵)/.test(
      value,
    )
  ) {
    return true;
  }
  if (
    /(?:한|두|세|네)\s*시(?:\s*반)?\s*(?:쯤|경|무렵|정도(?:에)?)/.test(value)
  ) {
    return true;
  }
  if (/\d{1,2}\s*시(?:\s*반|(?:\s*\d{1,2}\s*분))?\s*정도(?:에)?/.test(value)) {
    return true;
  }
  if (
    /\b(?:around|about)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i.test(value)
  ) {
    return true;
  }
  if (/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?-ish\b/i.test(value)) {
    return true;
  }
  return false;
}

export function hasUnsupportedDateRange(text: string): boolean {
  return DATE_RANGE_RE.test(text.trim());
}

export function hasExpandedRepeatIntent(text: string): boolean {
  return EXPANDED_REPEAT_RE.test(text.trim());
}

/** Until more range syntaxes are parsed end-to-end, never keep only the first HH:MM. */
export function hasUnsupportedColonClockRange(text: string): boolean {
  return [...text.matchAll(COLON_CLOCK_RE)].length >= 2;
}

/** `오후 03:00` used to fall through to 03:00. Keep it unresolved instead. */
export function hasMixedKoreanMeridiemColon(text: string): boolean {
  return MIXED_KO_MERIDIEM_COLON_RE.test(text.trim());
}

/**
 * End-only / deadline language. Production cannot yet model deadline semantics,
 * so these must never become a start-time auto schedule.
 * Supported “부터 … 까지” clock ranges are excluded.
 */
export function hasDeadlineExpression(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (KO_CLOCK_RANGE_RE.test(value)) return false;
  return DEADLINE_RE.test(value);
}

function exactTimeOnlyMinutes(text: string): number | null {
  const value = text.trim();

  const ko = value.match(/(오전|오후)\s*(\d{1,2})\s*시(?:\s*(반)|(?:\s*(\d{1,2})\s*분))?/);
  if (ko) {
    let hour = Number(ko[2]);
    const minute = ko[3] === "반" ? 30 : ko[4] ? Number(ko[4]) : 0;
    if (ko[1] === "오후" && hour < 12) hour += 12;
    if (ko[1] === "오전" && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  const h24 = value.match(/(?:^|\s)(1[3-9]|2[0-3])\s*시/);
  if (h24) return Number(h24[1]) * 60;

  const en = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (en) {
    let hour = Number(en[1]);
    const minute = en[2] ? Number(en[2]) : 0;
    if (en[3].toLowerCase() === "pm" && hour < 12) hour += 12;
    if (en[3].toLowerCase() === "am" && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  const colon = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  return null;
}

/** A clock without a date means today only while that clock is still ahead. */
export function hasPastTimeOnlyClock(text: string, now = new Date()): boolean {
  const value = text.trim();
  if (DATE_ANCHOR_RE.test(value)) return false;
  if (hasMixedKoreanMeridiemColon(value)) return false;
  const minutes = exactTimeOnlyMinutes(value);
  if (minutes === null) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return minutes <= currentMinutes;
}

export function hasPastDateReference(text: string, now = new Date()): boolean {
  const value = text.trim();
  if (PAST_WORD_RE.test(value)) return true;

  const ymd = value.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    d.setHours(23, 59, 59, 999);
    return d.getTime() < now.getTime();
  }

  const md = value.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ??
    value.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (md) {
    const d = new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2]));
    d.setHours(23, 59, 59, 999);
    return d.getTime() < now.getTime();
  }

  return false;
}
