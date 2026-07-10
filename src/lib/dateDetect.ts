/** Lightweight date/time keyword detection (KO + EN). Returns datetime guess or null. */

const RELATIVE_DATE_RE =
  /오늘|내일|모레|글피|다음\s*주|이번\s*주|주말|today|tomorrow|day after tomorrow|next\s+week|this\s+week|weekend/i;

const ABSOLUTE_DATE_RE =
  /(\d{1,2})\s*월\s*(\d{1,2})\s*일|\b(\d{1,2})[/-](\d{1,2})\b|(일|월|화|수|목|금|토)요일|\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;

export type MirrorTimingExtra = {
  suggestedStart?: string;
  timingReason?: string;
  timingConfidence?: "high" | "low";
};

export type ResolvedTiming = {
  start: Date;
  reason: string;
  confidence: "high" | "low";
};

export function isRelativeDateReference(text: string): boolean {
  return RELATIVE_DATE_RE.test(text);
}

export function isAbsoluteDateReference(text: string): boolean {
  return ABSOLUTE_DATE_RE.test(text);
}

/** Cache key segment so absolute vs relative date results never collide. */
export function aiCacheKeyText(text: string): string {
  const kind = isRelativeDateReference(text)
    ? "rel"
    : isAbsoluteDateReference(text)
      ? "abs"
      : "none";
  return `${kind}::${text.trim()}`;
}

export function hasScheduleTimeIntent(text: string): boolean {
  if (detectDate(text)) return true;
  if (/생일|birthday|기념일|anniversary/i.test(text)) return true;
  return false;
}

function clampSuggestedStart(d: Date): Date {
  const out = new Date(d);
  const h = out.getHours();
  const m = out.getMinutes();
  if (h === 0 && m === 0) {
    out.setHours(9, 0, 0, 0);
    return out;
  }
  if (h < 7 || h > 22 || (h === 22 && m > 0)) {
    out.setHours(9, 0, 0, 0);
  }
  return out;
}

function parseSuggestedStartIso(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return clampSuggestedStart(d);
}

function readTimingExtra(
  source: Record<string, unknown> | null | undefined,
): MirrorTimingExtra | null {
  if (!source) return null;
  const suggestedStart =
    typeof source.suggestedStart === "string" ? source.suggestedStart : undefined;
  const timingReason =
    typeof source.timingReason === "string"
      ? source.timingReason
      : typeof source.reason === "string"
        ? source.reason
        : undefined;
  const confRaw =
    typeof source.timingConfidence === "string"
      ? source.timingConfidence
      : typeof source.confidence === "string"
        ? source.confidence
        : undefined;
  const timingConfidence =
    confRaw === "high" || confRaw === "low" ? confRaw : undefined;
  if (!suggestedStart && !timingReason && !timingConfidence) return null;
  return { suggestedStart, timingReason, timingConfidence };
}

/** Resolve AI timing from cache extras + rule-based date priority for relative phrases. */
export function resolveTimingSuggestion(
  text: string,
  mirror: { suggestedDateText?: string } | null | undefined,
  cacheExtra?: MirrorTimingExtra | null,
  lang: "ko" | "en" = "ko",
  now = new Date(),
): ResolvedTiming | null {
  const trimmed = text.trim();
  if (!hasScheduleTimeIntent(trimmed)) return null;

  const relative = isRelativeDateReference(trimmed);
  const extra = cacheExtra ?? readTimingExtra(mirror as Record<string, unknown>);

  let start: Date | null = null;
  let reason = extra?.timingReason?.trim() ?? "";
  let confidence: "high" | "low" =
    extra?.timingConfidence === "high" ? "high" : "low";

  if (relative) {
    const det = detectDate(trimmed);
    if (!det) return null;
    start = det.start;
    confidence = "low";
    if (!reason) reason = calmSuggestionReason(trimmed, lang) ?? "";
  } else if (extra?.suggestedStart) {
    start = parseSuggestedStartIso(extra.suggestedStart);
    if (!reason) reason = calmSuggestionReason(trimmed, lang) ?? "";
  } else {
    const det =
      detectDate(trimmed) ??
      (mirror?.suggestedDateText
        ? detectDate(mirror.suggestedDateText)
        : null);
    if (!det) return null;
    start = det.start;
    confidence = "low";
    if (!reason) reason = calmSuggestionReason(trimmed, lang) ?? "";
  }

  if (!start || !reason) return null;

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  if (start.getTime() < dayStart.getTime()) return null;

  return { start, reason, confidence };
}

/** Compact label for the return-to-suggestion pill. */
export function formatSuggestionPill(d: Date, lang: "ko" | "en"): string {
  const locale = lang === "en" ? "en-US" : "ko-KR";
  if (lang === "ko") {
    const md = d.toLocaleDateString("ko-KR", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
    const hours = d.getHours();
    const period = hours < 12 ? "오전" : "오후";
    const h12 = hours % 12 || 12;
    const min = d.getMinutes().toString().padStart(2, "0");
    return `${md} ${period} ${h12}:${min}`;
  }
  return d.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Split date/time lines for the SUGGESTED suggestion card. */
export function formatSuggestionCardParts(
  d: Date,
  lang: "ko" | "en",
): { dateLine: string; timeLine: string } {
  const locale = lang === "en" ? "en-US" : "ko-KR";
  if (lang === "ko") {
    const dateLine = d.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    const hours = d.getHours();
    const period = hours < 12 ? "오전" : "오후";
    const h12 = hours % 12 || 12;
    const min = d.getMinutes().toString().padStart(2, "0");
    return { dateLine, timeLine: `${period} ${h12}:${min}` };
  }
  return {
    dateLine: d.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      weekday: "short",
    }),
    timeLine: d.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

/** Schedule tab status badge — shown once (no ring duplicate). */
export function scheduleStatusBadge(
  startIso: string,
  lang: "ko" | "en",
  now = new Date(),
): string {
  const start = new Date(startIso);
  if (start.getTime() > now.getTime()) {
    return lang === "en" ? "Before start" : "시작 전";
  }
  return lang === "en" ? "Started" : "시작됨";
}

/** Ended more than 24 hours ago — belongs in "흘러간 것". */
export function isFlowedPast(endIso: string, now = new Date()): boolean {
  return new Date(endIso).getTime() < now.getTime() - 24 * 60 * 60 * 1000;
}

const KO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const EN_WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function nextWeekday(
  targetDay: number,
  from: Date,
  includeToday: boolean,
): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  let diff = (targetDay - d.getDay() + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export function detectDate(
  text: string,
): { label: string; start: Date; end: Date } | null {
  const now = new Date();
  let target = new Date(now);
  let matched = false;
  let timeSet = false;
  let label = "";
  const lower = text.toLowerCase();

  // Korean relative days
  if (/오늘/.test(text)) {
    matched = true;
    label = "오늘";
  } else if (/내일/.test(text)) {
    target.setDate(now.getDate() + 1);
    matched = true;
    label = "내일";
  } else if (/모레/.test(text)) {
    target.setDate(now.getDate() + 2);
    matched = true;
    label = "모레";
  } else if (/글피/.test(text)) {
    target.setDate(now.getDate() + 3);
    matched = true;
    label = "글피";
  }

  // English relative days
  if (/\btoday\b/i.test(text)) {
    matched = true;
    label = label || "Today";
  } else if (/\btomorrow\b/i.test(text)) {
    target.setDate(now.getDate() + 1);
    matched = true;
    label = label || "Tomorrow";
  } else if (/\bday after tomorrow\b/i.test(text)) {
    target.setDate(now.getDate() + 2);
    matched = true;
    label = label || "Day after tomorrow";
  }

  // Next week
  if (/다음\s*주/.test(text) || /\bnext\s+week\b/i.test(text)) {
    target.setDate(now.getDate() + 7);
    matched = true;
    label = label || (/next/i.test(text) ? "Next week" : "다음 주");
  }

  // Korean weekday: 월요일
  const koWd = text.match(/(일|월|화|수|목|금|토)요일/);
  if (koWd) {
    const idx = KO_WEEKDAYS.indexOf(koWd[1] as (typeof KO_WEEKDAYS)[number]);
    if (idx >= 0) {
      target = nextWeekday(idx, now, true);
      matched = true;
      label = `${koWd[1]}요일`;
    }
  }

  // English weekday
  if (!koWd) {
    const enWd = lower.match(
      /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
    );
    if (enWd) {
      const idx = EN_WEEKDAYS.indexOf(enWd[1] as (typeof EN_WEEKDAYS)[number]);
      if (idx >= 0) {
        target = nextWeekday(idx, now, true);
        matched = true;
        label = enWd[1].charAt(0).toUpperCase() + enWd[1].slice(1);
      }
    }
  }

  // M월 D일 / M/D / M-D
  const md = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (md) {
    const m = parseInt(md[1], 10) - 1;
    const d = parseInt(md[2], 10);
    target = new Date(now.getFullYear(), m, d);
    if (target < now) target.setFullYear(now.getFullYear() + 1);
    matched = true;
    label = `${m + 1}월 ${d}일`;
  } else {
    const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
    if (slash) {
      const m = parseInt(slash[1], 10) - 1;
      const d = parseInt(slash[2], 10);
      target = new Date(now.getFullYear(), m, d);
      if (target < now) target.setFullYear(now.getFullYear() + 1);
      matched = true;
      label = `${m + 1}/${d}`;
    }
  }

  // Korean time: 오후 N시
  const hmKo = text.match(
    /(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/,
  );
  if (hmKo) {
    let h = parseInt(hmKo[2], 10);
    const mn = hmKo[3] ? parseInt(hmKo[3], 10) : 0;
    if (hmKo[1] === "오후" && h < 12) h += 12;
    if (hmKo[1] === "오전" && h === 12) h = 0;
    target.setHours(h, mn, 0, 0);
    matched = true;
    timeSet = true;
    label =
      `${label ? label + " " : ""}${hmKo[1] ?? ""}${h % 12 || 12}시${mn ? ` ${mn}분` : ""}`.trim();
  }

  // English time: 3pm, 3:30 pm, 15:00
  const hmEn = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (hmEn) {
    let h = parseInt(hmEn[1], 10);
    const mn = hmEn[2] ? parseInt(hmEn[2], 10) : 0;
    if (hmEn[3] === "pm" && h < 12) h += 12;
    if (hmEn[3] === "am" && h === 12) h = 0;
    target.setHours(h, mn, 0, 0);
    matched = true;
    timeSet = true;
    label = label || `${hmEn[1]}:${hmEn[2] ?? "00"} ${hmEn[3]}`;
  } else {
    const hm24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (hm24) {
      target.setHours(parseInt(hm24[1], 10), parseInt(hm24[2], 10), 0, 0);
      matched = true;
      timeSet = true;
      label = label || hm24[0];
    }
  }

  if (matched && !timeSet) {
    target.setHours(9, 0, 0, 0);
  }

  if (!matched) return null;
  const end = new Date(target);
  end.setHours(end.getHours() + 1);
  return { label, start: target, end };
}

/** One calm sentence below the suggested time — no AI calls. */
export function calmSuggestionReason(
  text: string,
  lang: "ko" | "en",
): string | null {
  const det = detectDate(text);
  if (!det) return null;
  const t = text.toLowerCase();

  if (lang === "en") {
    if (/birthday|생일/.test(t)) {
      return "You could prepare with ease before the day arrives.";
    }
    if (/tomorrow|내일/.test(t) || det.label === "Tomorrow" || det.label === "내일") {
      return "Tomorrow might be a good moment to think about this again.";
    }
    if (/next\s+week|다음\s*주/.test(t)) {
      return "Next week should leave enough room to prepare.";
    }
    if (/weekend|주말/.test(t)) {
      return "The weekend could be a calm time to come back to this.";
    }
    if (/today|오늘/.test(t)) {
      return "Today could be enough — no need to carry it all day.";
    }
    return "That moment should give you space to prepare.";
  }

  if (/생일/.test(text)) {
    return "생일 전에 여유 있게 준비할 수 있을 것 같아요.";
  }
  if (/내일/.test(text) || det.label === "내일") {
    return "내일쯤 다시 떠올리면 준비하기 좋을 것 같아요.";
  }
  if (/다음\s*주/.test(text)) {
    return "다음 주면 여유 있게 준비할 수 있을 것 같아요.";
  }
  if (/주말/.test(text)) {
    return "주말이면 마음 놓고 챙길 수 있을 것 같아요.";
  }
  if (/오늘/.test(text)) {
    return "오늘 안에 가볍게 떠올려보면 좋을 것 같아요.";
  }
  return "그때쯤 다시 떠올리면 준비하기 좋을 것 같아요.";
}

export function formatDateLabel(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

export function countdown(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "시작됨";
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}일 ${h}시간 남음`;
  if (h > 0) return `${h}시간 ${m}분 남음`;
  return `${m}분 남음`;
}

export function dDay(target: Date): {
  label: string;
  tone: "normal" | "soon" | "today";
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  const diff = Math.round((t.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return { label: "D-DAY", tone: "today" };
  if (diff < 0) return { label: `D+${-diff}`, tone: "normal" };
  if (diff <= 3) return { label: `D-${diff}`, tone: "soon" };
  return { label: `D-${diff}`, tone: "normal" };
}

/** Naive keyword auto-group for archive. */
export function archiveGroup(text: string): {
  key: string;
  label: string;
  emoji: string;
} {
  const t = text.toLowerCase();
  if (/해야|todo|할일|할 일|마감|제출|확인/.test(t))
    return { key: "todo", label: "나중에", emoji: "→" };
  if (/아이디어|idea|생각|컨셉|기획/.test(t))
    return { key: "idea", label: "아이디어", emoji: "💡" };
  if (/카페|식당|가게|주소|장소|매장|호텔/.test(t))
    return { key: "place", label: "장소", emoji: "📍" };
  if (/읽|책|영화|드라마|보기|시청|영상|유튜브/.test(t))
    return { key: "read", label: "읽기·보기", emoji: "📚" };
  return { key: "etc", label: "기타", emoji: "·" };
}
