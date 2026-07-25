import type { InboxItem } from "@/lib/store";
import type { ClarifyPick } from "@/lib/nlSchedule";
import { NlSchedulePrompt } from "./NlSchedulePrompt";

type Props = {
  item: InboxItem;
  acknowledged?: boolean;
  onConfirmScheduleQuick: (item: InboxItem) => void | Promise<void>;
  onConfirmClarify: (
    item: InboxItem,
    pick: ClarifyPick,
  ) => void | Promise<void>;
  onConfirmTaskLater: (item: InboxItem) => void | Promise<void>;
  onSchedule: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onLetGo: (item: InboxItem) => void | Promise<void>;
  onDismiss: () => void;
};

/** Lightweight Brain Mirror card — NL understanding with one-tap confirm. */
export function InlinePromise({
  item,
  acknowledged = false,
  onConfirmScheduleQuick,
  onConfirmClarify,
  onConfirmTaskLater,
  onSchedule,
  onArchive,
  onLetGo,
  onDismiss,
}: Props) {
  return (
    <NlSchedulePrompt
      item={item}
      acknowledged={acknowledged}
      onConfirmScheduleQuick={onConfirmScheduleQuick}
      onConfirmClarify={onConfirmClarify}
      onConfirmTaskLater={onConfirmTaskLater}
      onOpenManualSchedule={onSchedule}
      onArchive={onArchive}
      onLetGo={onLetGo}
      onDismiss={onDismiss}
    />
  );
}
