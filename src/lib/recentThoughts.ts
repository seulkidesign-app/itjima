import { detectDate } from "@/lib/dateDetect";
import { archiveGroup } from "@/lib/dateDetect";
import { classifySchedule } from "@/lib/scheduleGroups";
import type { ArchiveItem, InboxItem, ScheduleItem } from "@/lib/store";
import { thoughtFirstLine } from "@/lib/brainMirror";

export type RecentThoughtRow = {
  id: string;
  title: string;
  destinationKo: string;
  destinationEn: string;
  created_at: string;
};

function inboxDestination(
  item: InboxItem,
  lang: "ko" | "en",
): { ko: string; en: string } {
  const date = detectDate(item.text);
  if (date) {
    const bucket = classifySchedule(date.start.toISOString());
    if (bucket === "today" || bucket === "now") {
      return { ko: "오늘", en: "Today" };
    }
    if (bucket === "tomorrow") {
      return { ko: "내일", en: "Tomorrow" };
    }
    return { ko: date.label || "예정", en: date.label || "Scheduled" };
  }
  return { ko: "시점 미정", en: "No time yet" };
}

export function buildRecentThoughts(
  inbox: InboxItem[],
  archive: ArchiveItem[],
  schedules: ScheduleItem[],
  lang: "ko" | "en",
  limit = 5,
): RecentThoughtRow[] {
  const rows: RecentThoughtRow[] = [];

  for (const item of inbox) {
    const dest = inboxDestination(item, lang);
    rows.push({
      id: `inbox:${item.id}`,
      title: thoughtFirstLine(item.text),
      destinationKo: dest.ko,
      destinationEn: dest.en,
      created_at: item.created_at,
    });
  }

  for (const item of archive) {
    const group = archiveGroup(item.text);
    rows.push({
      id: `archive:${item.id}`,
      title: thoughtFirstLine(item.text),
      destinationKo: "생각 보관함",
      destinationEn: "Vault",
      created_at: item.created_at,
    });
  }

  for (const item of schedules.filter((s) => s.status !== "done")) {
    const bucket = classifySchedule(item.start_time);
    const dest =
      bucket === "today" || bucket === "now"
        ? { ko: "오늘", en: "Today" }
        : bucket === "tomorrow"
          ? { ko: "내일", en: "Tomorrow" }
          : { ko: "예정", en: "Upcoming" };
    rows.push({
      id: `schedule:${item.id}`,
      title: thoughtFirstLine(item.text),
      destinationKo: dest.ko,
      destinationEn: dest.en,
      created_at: item.created_at,
    });
  }

  return rows
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, limit);
}
