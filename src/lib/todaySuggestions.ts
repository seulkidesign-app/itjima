import type { ArchiveItem, ScheduleItem } from "@/lib/store";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";
import { remainingUntil } from "@/lib/scheduleTime";
import { formatSuggestedMoment } from "@/lib/scheduleChoices";
import { isFlowedPast } from "@/lib/dateDetect";

export type TodaySuggestion = {
  messageKo: string;
  messageEn: string;
  kind: "prepare" | "rediscovery" | "calm";
  scheduleId?: string;
  rediscoveryPath?: boolean;
};

/** Due thoughts stay actionable until the user resolves or snoozes them. */
export function dueSchedules(
  items: ScheduleItem[],
  pins: Set<string>,
  now = new Date(),
): ScheduleItem[] {
  const nowMs = now.getTime();
  return items
    .filter((item) => item.status !== "done")
    .filter(
      (item) =>
        pins.has(item.id) || new Date(item.start_time).getTime() <= nowMs,
    )
    .sort(
      (a, b) =>
        new Date(a.start_time).getTime() -
        new Date(b.start_time).getTime(),
    );
}

/** Gentle, rule-based suggestions — no AI. */
export function pickTodaySuggestion(
  todayItems: ScheduleItem[],
  activeItems: ScheduleItem[],
  archiveItems: ArchiveItem[],
  _lang: "ko" | "en",
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
      messageKo: `내일 "${title}" — 오늘 한 번만 떠올려도 돼요.`,
      messageEn: `Tomorrow: "${title}" — a quiet look today is enough.`,
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
      messageKo: `${soon.r.days}일 뒤 "${title}" — 오늘 잠깐만 떠올려볼까요?`,
      messageEn: `"${title}" is in ${soon.r.days} days — worth a gentle look today.`,
    };
  }

  if (archiveItems.length >= 3 && todayItems.length === 0) {
    return {
      kind: "rediscovery",
      rediscoveryPath: true,
      messageKo: "맡겨둔 기억 중 하나를 꺼내봤어요.",
      messageEn: "One memory you left here is worth revisiting.",
    };
  }

  if (todayItems.length > 0) {
    return {
      kind: "calm",
      messageKo: "오늘은 이 생각만 보면 돼요.",
      messageEn: "This one thought is enough for today.",
    };
  }

  return null;
}

/** Spotlight card time line for the Today tab. */
export function formatTodaySpotlightTime(
  startIso: string,
  lang: "ko" | "en",
): string {
  return formatSuggestedMoment(
    new Date(startIso),
    lang === "en" ? "en" : "ko",
  );
}

/** Partition active items for Today vs 흘러간 것. */
export function partitionTodaySchedules(
  items: ScheduleItem[],
  pins: Set<string>,
  now = new Date(),
): { today: ScheduleItem[]; flowed: ScheduleItem[] } {
  const today: ScheduleItem[] = [];
  const flowed: ScheduleItem[] = [];

  for (const s of items) {
    if (isFlowedPast(s.end_time, now) && !pins.has(s.id)) {
      flowed.push(s);
      continue;
    }
    today.push(s);
  }

  today.sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  flowed.sort((a, b) => +new Date(b.end_time) - +new Date(a.end_time));

  return { today, flowed };
}
