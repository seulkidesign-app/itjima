/** Lightweight date/time keyword detection (KO + EN). Returns datetime guess or null. */

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

function nextWeekday(targetDay: number, from: Date, includeToday: boolean): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  let diff = (targetDay - d.getDay() + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export function detectDate(text: string): { label: string; start: Date; end: Date } | null {
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
  const hmKo = text.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  if (hmKo) {
    let h = parseInt(hmKo[2], 10);
    const mn = hmKo[3] ? parseInt(hmKo[3], 10) : 0;
    if (hmKo[1] === "오후" && h < 12) h += 12;
    if (hmKo[1] === "오전" && h === 12) h = 0;
    target.setHours(h, mn, 0, 0);
    matched = true;
    timeSet = true;
    label = `${label ? label + " " : ""}${hmKo[1] ?? ""}${h % 12 || 12}시${mn ? ` ${mn}분` : ""}`.trim();
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

export function dDay(target: Date): { label: string; tone: "normal" | "soon" | "today" } {
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
export function archiveGroup(text: string): { key: string; label: string; emoji: string } {
  const t = text.toLowerCase();
  if (/해야|todo|할일|할 일|마감|제출|확인/.test(t)) return { key: "todo", label: "할 일", emoji: "✅" };
  if (/아이디어|idea|생각|컨셉|기획/.test(t)) return { key: "idea", label: "아이디어", emoji: "💡" };
  if (/카페|식당|가게|주소|장소|매장|호텔/.test(t)) return { key: "place", label: "장소", emoji: "📍" };
  if (/읽|책|영화|드라마|보기|시청|영상|유튜브/.test(t)) return { key: "read", label: "읽기·보기", emoji: "📚" };
  return { key: "etc", label: "기타", emoji: "🗂" };
}
