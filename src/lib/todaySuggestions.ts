import type { ArchiveItem, ScheduleItem } from "@/lib/store";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";
import { remainingUntil } from "@/lib/scheduleTime";

export type TodaySuggestion = {
  messageKo: string;
  messageEn: string;
  kind: "prepare" | "rediscovery" | "calm";
  scheduleId?: string;
  rediscoveryPath?: boolean;
};

/** Gentle, rule-based suggestions — no AI. */
export function pickTodaySuggestion(
  todayItems: ScheduleItem[],
  activeItems: ScheduleItem[],
  archiveItems: ArchiveItem[],
  lang: "ko" | "en",
): TodaySuggestion | null {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowItems = activeItems.filter((s) => {
    const d = new Date(s.start_time);
    return d.toDateString() === tomorrow.toDateString();
  });

  if (tomorrowItems.length > 0) {
    const next = tomorrowItems[0];
    const title = scheduleDisplayTitle(next);
    return {
      kind: "prepare",
      scheduleId: next.id,
      messageKo: `내일 "${title}" — 오늘 준비하면 여유로울 것 같아요.`,
      messageEn: `Tomorrow: "${title}" — a little prep today might feel easier.`,
    };
  }

  const soon = activeItems
    .map((s) => ({ s, r: remainingUntil(new Date(s.start_time), now) }))
    .filter(({ r }) => !r.past && r.days >= 1 && r.days <= 3)
    .sort((a, b) => a.r.ms - b.r.ms)[0];

  if (soon) {
    const title = scheduleDisplayTitle(soon.s);
    return {
      kind: "prepare",
      scheduleId: soon.s.id,
      messageKo: `${soon.r.days}일 뒤 "${title}" — 오늘 한 번 떠올려볼까요?`,
      messageEn: `"${title}" is in ${soon.r.days} days — worth a gentle look today.`,
    };
  }

  if (archiveItems.length >= 3 && todayItems.length === 0) {
    return {
      kind: "rediscovery",
      rediscoveryPath: true,
      messageKo: "오늘 다시 보면 좋을 기억이 있어요.",
      messageEn: "A memory worth revisiting today.",
    };
  }

  if (todayItems.length > 0) {
    return {
      kind: "calm",
      messageKo: "오늘은 이것만 봐도 충분해요.",
      messageEn: "These are enough for today.",
    };
  }

  return null;
}

export function formatTodayHeaderDate(lang: "ko" | "en", date = new Date()): string {
  return date.toLocaleDateString(lang === "en" ? "en-US" : "ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export function weekStripDays(anchor = new Date()): Date[] {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
