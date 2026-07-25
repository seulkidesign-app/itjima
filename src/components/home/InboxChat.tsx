import { ChatLongPressRow } from "@/components/ChatLongPressRow";
import { ChatBubble } from "@/components/ChatBubble";
import { InlinePromise } from "@/components/InlinePromise";
import { MemoryRevivalHint } from "@/components/MemoryRevivalHint";
import { FEATURES } from "@/lib/features";
import { useT } from "@/lib/i18n";
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
  onOpenDetail: (item: InboxItem) => void;
  onRetryCapture: (item: InboxItem) => void;
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
  onOpenDetail,
  onRetryCapture,
}: Props) {
  const t = useT();

  return (
    <div className="chat-scroll flex min-h-0 flex-1 flex-col gap-2 px-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-1">
      {itemsAsc.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-end pb-2">
          <p className="max-w-[15rem] text-center text-secondary leading-relaxed">
            {t(
              "머릿속에 맴도는 거, 여기에 던져 두세요.",
              "Whatever's circling — drop it here.",
            )}
          </p>
        </div>
      ) : (
        itemsAsc.map((it) => {
          const isNewest = it.id === newestId;
          return (
            <div key={it.id} className="flex flex-col gap-0.5" data-testid="chat-turn">
              <ChatBubble
                item={it}
                isNewest={isNewest}
                showTime
                onRetryCapture={() => onRetryCapture(it)}
                wrapBubble={(bubble) => (
                  <ChatLongPressRow
                    onLongPress={() => onOpenContextMenu(it.id)}
                    onTap={() => onOpenDetail(it)}
                  >
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
        })
      )}
      <div
        ref={listEndRef}
        data-testid="chat-scroll-sentinel"
        className="h-px w-full shrink-0 scroll-mt-3"
        aria-hidden
      />
    </div>
  );
}
