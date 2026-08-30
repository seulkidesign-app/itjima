const NEGATION_RE =
  /(?:안\s*(?:가|해|하|할|갈|먹|만나)|하지\s*말|하지\s*않|않\s*(?:가|해|하)|없어짐|없어졌|취소(?:됐|됨|해|할)?|cancel(?:led|ed)?)/i;

const RETRIEVAL_QUESTION_RE =
  /(?:\?|뭐지|뭐\s*였|뭐\s*있었|뭐\s*하지|몇\s*시(?:였|야|지)|일정\s*(?:뭐|보여|알려)|스케줄\s*(?:뭐|보여|알려)|(?:일정|스케줄).*보여\s*줘)/i;

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

/** A period word plus a clock still does not identify a calendar day. */
export function hasBroadUnresolvedDatePeriod(text: string): boolean {
  const value = text.trim();

  if (/다다음\s*주|week\s+after\s+next/i.test(value)) return true;

  const broadWeek = /(?:이번\s*주|다음\s*주|this\s+week|next\s+week)/i.test(value);
  if (broadWeek && !SPECIFIC_WEEKDAY_RE.test(value)) return true;

  if (BROAD_MONTH_RE.test(value) && !SPECIFIC_MONTH_DAY_RE.test(value)) return true;
  return false;
}

export function hasUnsupportedDateRange(text: string): boolean {
  return DATE_RANGE_RE.test(text.trim());
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
