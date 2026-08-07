import { ChatLongPressRow } from "@/components/ChatLongPressRow";
import { ChatBubble } from "@/components/ChatBubble";
import { InlinePromise } from "@/components/InlinePromise";
import { MemoryRevivalHint } from "@/components/MemoryRevivalHint";
import { ScheduleCommitmentCard } from "@/components/home/ScheduleCommitmentCard";
import { featureEnabled } from "@/lib/features";
import { useLang, useT } from "@/lib/i18n";
import {
  understandNaturalLanguage,
  type ClarifyPick,
} from "@/lib/nlSchedule";
import { scheduleConfirmationReason } from "@/lib/nlScheduleSafety";
import { shouldShowInlinePromise } from "@/lib/promiseCard";
import type { InboxItem } from "@/lib/store";
import type { RevivalHint } from "@/lib/memoryRevival";
import { HomeEmptyHero } from "@/components/home/HomeEmptyHero";

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
  onConfirmClarifySchedule: (
    item: InboxItem,
    pick: ClarifyPick,
  ) => void | Promise<void>;
  onConfirmTaskLater: (item: InboxItem) => void | Promise<void>;
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
  onConfirmClarifySchedule,
  onConfirmTaskLater,
  onOpenPromiseSchedule,
  onMoveToDelete,
  onAcknowledgeItem,
  onMaybeNudgeLogin,
  onOpenDetail,
  onRetryCapture,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";

  return (
    <div className="home-chat-lane chat-scroll flex min-h-0 flex-1 flex-col gap-2 px-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-1">
      {itemsAsc.length === 0 ? (
        <HomeEmptyHero />
      ) : (
        itemsAsc.map((it) => {
          const isNewest = it.id === newestId;
          const showPromise =
            featureEnabled("INLINE_PROMISE") &&
            !acknowledgedIds.has(it.id) &&
            shouldShowInlinePromise(it.text, uiLang);
          const understanding = showPromise
            ? understandNaturalLanguage(it.text, uiLang)
            : null;
          const confirmationReason =
            understanding?.intent === "schedule_exact"
              ? scheduleConfirmationReason(it.text)
              : null;
          const showCommitment =
            understanding?.intent === "schedule_exact" && !confirmationReason;

          return (
            <div
              key={it.id}
              className="home-chat-turn flex flex-col gap-0.5"
              data-testid="chat-turn"
              data-newest={isNewest ? "true" : "false"}
              data-has-promise={showPromise ? "true" : "false"}
            >
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
                {featureEnabled("REDISCOVERY") && inboxRevival?.sourceId === it.id && (
                  <MemoryRevivalHint
                    hint={inboxRevival}
                    compact
                    delayMs={900}
                    onRevisit={onRevisitArchiveMemory}
                    onDismiss={onInboxRevivalDismiss}
                  />
                )}
              </ChatBubble>

              {showPromise && showCommitment && (
                <ScheduleCommitmentCard
                  item={it}
                  onConfirm={onConfirmScheduleQuick}
                  onAdjust={onOpenPromiseSchedule}
                  onDismiss={() => {
                    onAcknowledgeItem(it.id);
                    onMaybeNudgeLogin();
                  }}
                />
              )}

              {showPromise && !showCommitment && (
                <InlinePromise
                  item={it}
                  acknowledged={acknowledgedIds.has(it.id)}
                  onConfirmScheduleQuick={onConfirmScheduleQuick}
                  onConfirmClarify={onConfirmClarifySchedule}
                  onConfirmTaskLater={onConfirmTaskLater}
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
