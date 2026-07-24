import { ChatLongPressRow } from "@/components/ChatLongPressRow";
import { ChatBubble } from "@/components/ChatBubble";
import { InlinePromise } from "@/components/InlinePromise";
import { MemoryRevivalHint } from "@/components/MemoryRevivalHint";
import { FEATURES } from "@/lib/features";
import type { InboxItem } from "@/lib/store";
import type { RevivalHint } from "@/lib/memoryRevival";

type Props = {
  itemsAsc: InboxItem[];
  newestId: string | undefined;
  inboxRevival: RevivalHint | null;
  onInboxRevivalDismiss: () => void;
  onRevisitArchiveMemory: (memoryId: string) => void;
  acknowledgedIds: Set<string>;
  listEndRef: React.RefObject<HTMLDivElement | null>;
  onMoveToArchive: (item: InboxItem) => void | Promise<void>;
  onOpenContextMenu: (id: string) => void;
  onConfirmScheduleQuick: (item: InboxItem) => void | Promise<void>;
  onOpenPromiseSchedule: (item: InboxItem) => void;
  onMoveToDelete: (item: InboxItem) => void | Promise<void>;
  onAcknowledgeItem: (id: string) => void;
  onMaybeNudgeLogin: () => void;
};

export function InboxChat({
  itemsAsc,
  newestId,
  inboxRevival,
  onInboxRevivalDismiss,
  onRevisitArchiveMemory,
  acknowledgedIds,
  listEndRef,
  onMoveToArchive,
  onOpenContextMenu,
  onConfirmScheduleQuick,
  onOpenPromiseSchedule,
  onMoveToDelete,
  onAcknowledgeItem,
  onMaybeNudgeLogin,
}: Props) {
  return (
    <div className="chat-scroll flex min-h-0 flex-1 flex-col gap-4 px-3 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-2">
      {itemsAsc.map((it) => {
        const isNewest = it.id === newestId;
        return (
          <div key={it.id} className="flex flex-col gap-2.5" data-testid="chat-turn">
            <ChatBubble
              item={it}
              isNewest={isNewest}
              showTime
              wrapBubble={(bubble) => (
                <ChatLongPressRow onLongPress={() => onOpenContextMenu(it.id)}>
                  {bubble}
                </ChatLongPressRow>
              )}
            >
              {FEATURES.REDISCOVERY && inboxRevival?.sourceId === it.id && (
                  <MemoryRevivalHint
                    hint={inboxRevival}
                    compact
                    delayMs={900}
                    onRevisit={onRevisitArchiveMemory}
                    onDismiss={onInboxRevivalDismiss}
                  />
                )}
            </ChatBubble>

            {FEATURES.INLINE_PROMISE && (
              <InlinePromise
                item={it}
                acknowledged={acknowledgedIds.has(it.id)}
                onConfirmScheduleQuick={onConfirmScheduleQuick}
                onSchedule={onOpenPromiseSchedule}
                onArchive={async (item) => {
                  await onMoveToArchive(item);
                  onMaybeNudgeLogin();
                }}
                onLetGo={async (item) => {
                  await onMoveToDelete(item);
                }}
                onDismiss={() => {
                  onAcknowledgeItem(it.id);
                  onMaybeNudgeLogin();
                }}
              />
            )}
          </div>
        );
      })}
      <div
        ref={listEndRef}
        data-testid="chat-scroll-sentinel"
        className="h-px w-full shrink-0 scroll-mt-3"
        aria-hidden
      />
    </div>
  );
}
