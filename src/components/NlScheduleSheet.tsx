import { BottomSheet } from "./BottomSheet";
import { NlSchedulePrompt } from "./NlSchedulePrompt";
import { useT } from "@/lib/i18n";
import type { ClarifyPick } from "@/lib/nlSchedule";
import type { InboxItem } from "@/lib/store";

type Props = {
  item: InboxItem | null;
  open: boolean;
  onClose: () => void;
  onConfirmScheduleQuick: (item: InboxItem) => void | Promise<void>;
  onConfirmClarify: (
    item: InboxItem,
    pick: ClarifyPick,
  ) => void | Promise<void>;
  onConfirmTaskLater: (item: InboxItem) => void | Promise<void>;
  onOpenManualSchedule: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onLetGo: (item: InboxItem) => void | Promise<void>;
};

export function NlScheduleSheet({
  item,
  open,
  onClose,
  onConfirmScheduleQuick,
  onConfirmClarify,
  onConfirmTaskLater,
  onOpenManualSchedule,
  onArchive,
  onLetGo,
}: Props) {
  const t = useT();
  if (!item) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="52dvh"
      title={t("잊지마가 이해한 내용", "What Itjima understood")}
    >
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <NlSchedulePrompt
          compact
          item={item}
          onConfirmScheduleQuick={onConfirmScheduleQuick}
          onConfirmClarify={onConfirmClarify}
          onConfirmTaskLater={onConfirmTaskLater}
          onOpenManualSchedule={(it) => {
            onClose();
            onOpenManualSchedule(it);
          }}
          onArchive={onArchive}
          onLetGo={onLetGo}
          onDismiss={onClose}
        />
      </div>
    </BottomSheet>
  );
}
