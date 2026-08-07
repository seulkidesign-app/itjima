import type { ScheduleConfirmOptions } from "@/components/ScheduleChoiceFlow";
import {
  buildNaturalScheduleDraft,
  hasNaturalScheduleTime,
} from "@/lib/naturalScheduleDraft";
import type { InboxItem } from "@/lib/store";

const DECK_SCHEDULE_DRAFT = "__itjimaDeckScheduleDraft" as const;

type InboxScheduleDraft = {
  text: string;
  startIso: string;
  endIso: string;
  options: ScheduleConfirmOptions;
};

type InboxItemWithDraft = InboxItem & {
  [DECK_SCHEDULE_DRAFT]?: InboxScheduleDraft;
};

export function hasExplicitScheduleTime(text: string): boolean {
  return hasNaturalScheduleTime(text);
}

/**
 * Attach one ephemeral, in-memory schedule choice to an inbox item.
 * The parent route still owns persistence, sync recovery, analytics, and undo.
 */
export function withInboxScheduleDraft(
  item: InboxItem,
  draft: {
    text: string;
    start: Date;
    end: Date;
    options: ScheduleConfirmOptions;
  },
): InboxItem {
  return {
    ...item,
    [DECK_SCHEDULE_DRAFT]: {
      text: draft.text,
      startIso: draft.start.toISOString(),
      endIso: draft.end.toISOString(),
      options: draft.options,
    },
  } as InboxItem;
}

/** Default schedule anchor when no sheet is shown. */
export function defaultScheduleStart(item: InboxItem): Date {
  return buildNaturalScheduleDraft(item).start;
}

export function inboxScheduleDefaults(item: InboxItem) {
  const draft = (item as InboxItemWithDraft)[DECK_SCHEDULE_DRAFT];
  if (draft) {
    return {
      start: new Date(draft.startIso),
      end: new Date(draft.endIso),
      text: draft.text,
      options: draft.options,
    };
  }

  const natural = buildNaturalScheduleDraft(item);
  return {
    start: natural.start,
    end: natural.end,
    text: natural.text,
    options: natural.options,
  };
}
