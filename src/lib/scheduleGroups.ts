import type { ScheduleItem } from "@/lib/store";

export type ScheduleSectionKey = "now" | "today" | "tomorrow" | "week" | "later";

export type ScheduleSection = {
  key: ScheduleSectionKey;
  items: ScheduleItem[];
};

const NOW_MS = 30 * 60 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function endOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  x.setDate(x.getDate() + diff);
  return endOfDay(x);
}

export function classifySchedule(startIso: string, now = new Date()): ScheduleSectionKey {
  const start = new Date(startIso);
  const t = start.getTime();
  const n = now.getTime();

  if (t >= n && t - n <= NOW_MS) return "now";
  if (t >= startOfDay(now).getTime() && t <= endOfDay(now).getTime()) return "today";

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (t >= startOfDay(tomorrow).getTime() && t <= endOfDay(tomorrow).getTime()) return "tomorrow";

  if (t <= endOfWeek(now).getTime()) return "week";
  return "later";
}

export function isMissed(s: ScheduleItem, now = new Date()): boolean {
  if (s.status === "done") return false;
  const end = new Date(s.end_time).getTime();
  return end < now.getTime() - 30 * 60 * 1000;
}

export function groupSchedules(items: ScheduleItem[], pins: Set<string>): ScheduleSection[] {
  const active = items.filter((s) => s.status !== "done");
  const order: ScheduleSectionKey[] = ["now", "today", "tomorrow", "week", "later"];
  const buckets = new Map<ScheduleSectionKey, ScheduleItem[]>(
    order.map((k) => [k, []]),
  );

  const sorted = [...active].sort((a, b) => {
    const ap = pins.has(a.id) ? 1 : 0;
    const bp = pins.has(b.id) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return +new Date(a.start_time) - +new Date(b.start_time);
  });

  for (const s of sorted) {
    buckets.get(classifySchedule(s.start_time))!.push(s);
  }

  return order
    .map((key) => ({ key, items: buckets.get(key)! }))
    .filter((g) => g.items.length > 0);
}

export function sectionLabel(key: ScheduleSectionKey, lang: "ko" | "en"): string {
  const ko: Record<ScheduleSectionKey, string> = {
    now: "지금",
    today: "오늘",
    tomorrow: "내일",
    week: "이번 주",
    later: "언젠가",
  };
  const en: Record<ScheduleSectionKey, string> = {
    now: "Now",
    today: "Today",
    tomorrow: "Tomorrow",
    week: "This week",
    later: "Someday",
  };
  return lang === "en" ? en[key] : ko[key];
}
