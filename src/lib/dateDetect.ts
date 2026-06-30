/** Lightweight Korean date/time keyword detection. Returns ISO datetime guess or null. */
export function detectDate(text: string): { label: string; start: Date; end: Date } | null {
  const now = new Date();
  let target = new Date(now);
  let matched = false;
  let label = "";

  // 오늘/내일/모레/글피
  if (/오늘/.test(text)) { matched = true; label = "오늘"; }
  else if (/내일/.test(text)) { target.setDate(now.getDate() + 1); matched = true; label = "내일"; }
  else if (/모레/.test(text)) { target.setDate(now.getDate() + 2); matched = true; label = "모레"; }
  else if (/글피/.test(text)) { target.setDate(now.getDate() + 3); matched = true; label = "글피"; }

  // 다음주 / 이번주
  if (/다음\s*주/.test(text)) { target.setDate(now.getDate() + 7); matched = true; label = "다음 주"; }

  // M월 D일
  const md = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (md) {
    const m = parseInt(md[1], 10) - 1;
    const d = parseInt(md[2], 10);
    target = new Date(now.getFullYear(), m, d);
    if (target < now) target.setFullYear(now.getFullYear() + 1);
    matched = true;
    label = `${m + 1}월 ${d}일`;
  }

  // 시간: 오후 N시 / 오전 N시 / N시 / N시 M분
  const hm = text.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  if (hm) {
    let h = parseInt(hm[2], 10);
    const mn = hm[3] ? parseInt(hm[3], 10) : 0;
    if (hm[1] === "오후" && h < 12) h += 12;
    if (hm[1] === "오전" && h === 12) h = 0;
    target.setHours(h, mn, 0, 0);
    matched = true;
    label = `${label ? label + " " : ""}${hm[1] ?? ""}${h % 12 || 12}시${mn ? ` ${mn}분` : ""}`.trim();
  } else if (matched) {
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
