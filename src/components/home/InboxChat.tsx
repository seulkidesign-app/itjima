import { InlinePromise } from "@/components/InlinePromise";
import { MemoryRevivalHint } from "@/components/MemoryRevivalHint";
import {
  SavedScheduleFeedback,
  type SavedScheduleFeedbackModel,
} from "@/components/home/SavedScheduleFeedback";
import { LeftItemRow } from "@/components/home/LeftItemRow";
import { featureEnabled } from "@/lib/features";
import { useLang, useT } from "@/lib/i18n";
import { canAutoCommitTimedCapture } from "@/lib/nlAutoCommit";
import { isStructuredTimedRecord } from "@/lib/recordTemporal";
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
  autoCommitInFlightIds: Set<string>;
  savedFeedback: SavedScheduleFeedbackModel | null;
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
  onEditCaptureText: (text: string, itemId: string) => void;
  onEditSavedSchedule: () => void;
  onOpenAllRecords?: () => void;
};

type ItemSurface =
  | { kind: "quiet"; item: InboxItem; isNewest: boolean }
  | {
      kind: "ambiguity";
      item: InboxItem;
      isNewest: boolean;
      recovery: boolean;
    };

export function InboxChat({
  itemsAsc,
  newestId,
  inboxRevival,
  onInboxRevivalDismiss,
  onRevisitArchiveMemory,
  acknowledgedIds,
  autoCommitInFlightIds,
  savedFeedback,
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
  onRetryCapture: _onRetryCapture,
  onEditCaptureText,
  onEditSavedSchedule,
  onOpenAllRecords,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";

  const surfaces: ItemSurface[] = itemsAsc
    .filter((it) => !isStructuredTimedRecord(it))
    .map((it) => {
    const isNewest = it.id === newestId;
    const inFlight = autoCommitInFlightIds.has(it.id);
    const autoEligible = canAutoCommitTimedCapture(it.text, uiLang);
    const basePromise =
      featureEnabled("INLINE_PROMISE") &&
      !acknowledgedIds.has(it.id) &&
      !inFlight &&
      shouldShowInlinePromise(it.text, uiLang);
    const understanding = basePromise
      ? understandNaturalLanguage(it.text, uiLang)
      : null;
    const confirmationReason = basePromise
      ? scheduleConfirmationReason(it.text)
      : null;
    const showCommitmentRecovery =
      basePromise && autoEligible && !confirmationReason;
    const showAmbiguity =
      basePromise &&
      !autoEligible &&
      (confirmationReason !== null ||
        understanding?.intent === "schedule_clarify");

    if (showAmbiguity || showCommitmentRecovery) {
      return {
        kind: "ambiguity" as const,
        item: it,
        isNewest,
        recovery: Boolean(showCommitmentRecovery),
      };
    }
    return { kind: "quiet" as const, item: it, isNewest };
  });

  const quietItems = surfaces.filter(
    (s): s is Extract<ItemSurface, { kind: "quiet" }> => s.kind === "quiet",
  );
  const questionSurfaces = surfaces.filter(
    (s): s is Extract<ItemSurface, { kind: "ambiguity" }> =>
      s.kind === "ambiguity",
  );
  const isEmpty = surfaces.length === 0 && !savedFeedback;
  // Many Records: keep Home sparse — show a short recent slice only.
  // Keep ascending order (newest at bottom) for Capture chat scroll semantics.
  const HOME_RECENT_LIMIT = 3;
  const recentQuiet = quietItems.slice(-HOME_RECENT_LIMIT);
  const olderQuietCount = Math.max(0, quietItems.length - recentQuiet.length);

  return (
    <div className="home-chat-lane chat-scroll flex min-h-0 flex-1 flex-col gap-3 px-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-2">
      {isEmpty ? (
        <>
          <HomeEmptyHero />
          {onOpenAllRecords && (
            <div className="flex justify-center">
              <button
                type="button"
                data-testid="open-all-records"
                onClick={onOpenAllRecords}
                className="touch-press min-h-11 px-2 text-center text-[13px] font-semibold text-ink-soft underline-offset-2 hover:underline"
              >
                {t("전체 기록", "All records")}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {questionSurfaces.map(({ item: it, isNewest, recovery }) => (
            <div
              key={it.id}
              className="home-chat-turn flex flex-col gap-1"
              data-testid="chat-turn"
              data-newest={isNewest ? "true" : "false"}
              data-has-promise="true"
            >
              {recovery ? (
                <div
                  className="quietly-feedback-card w-full px-4 py-3.5"
                  data-testid="capture-commit-recovery"
                >
                  <p className="text-[16px] font-semibold text-ink">
                    {it.text.trim() || t("남겨뒀어요", "Left it here")}
                  </p>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    {t(
                      "시간을 확인하지 못했어요.",
                      "Couldn't confirm the time.",
                    )}
                  </p>
                  <button
                    type="button"
                    data-testid="capture-commit-recovery-edit"
                    onClick={() => onOpenPromiseSchedule(it)}
                    className="touch-press mt-2 inline-flex min-h-11 items-center px-1 text-[13px] font-medium text-ink-soft underline-offset-2 hover:underline"
                  >
                    {t("수정", "Edit")}
                  </button>
                </div>
              ) : (
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
                  onEditCaptureText={(text) => onEditCaptureText(text, it.id)}
                />
              )}
              {featureEnabled("REDISCOVERY") &&
                inboxRevival?.sourceId === it.id && (
                  <MemoryRevivalHint
                    hint={inboxRevival}
                    compact
                    delayMs={900}
                    onRevisit={onRevisitArchiveMemory}
                    onDismiss={onInboxRevivalDismiss}
                  />
                )}
            </div>
          ))}

          {recentQuiet.length > 0 && (
            <section
              className="flex flex-col"
              data-testid="left-items-section"
              aria-label={t("방금 남긴 것", "Just left")}
            >
              <h2 className="quietly-section-label mb-1">
                {t("방금 남긴 것", "Just left")}
              </h2>
              <ul className="flex flex-col">
                {recentQuiet.map(({ item: it, isNewest }) => (
                  <LeftItemRow
                    key={it.id}
                    item={it}
                    isNewest={isNewest}
                    onSetTime={() => onOpenPromiseSchedule(it)}
                    onOpenMenu={() => onOpenContextMenu(it.id)}
                    onOpenDetail={() => onOpenDetail(it)}
                  />
                ))}
              </ul>
              {onOpenAllRecords && (
                <button
                  type="button"
                  data-testid="open-all-records"
                  onClick={onOpenAllRecords}
                  className="touch-press mx-auto mt-3 min-h-11 px-2 text-center text-[13px] font-semibold text-ink-soft underline-offset-2 hover:underline"
                >
                  {olderQuietCount > 0
                    ? t(
                        `이전 기록 보기 ${olderQuietCount} →`,
                        `View ${olderQuietCount} earlier →`,
                      )
                    : t("이전 기록 보기 →", "View earlier records →")}
                </button>
              )}
            </section>
          )}

          {!recentQuiet.length && onOpenAllRecords && (
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="open-all-records"
                onClick={onOpenAllRecords}
                className="touch-press min-h-11 px-1 text-[13px] font-semibold text-ink-soft underline-offset-2 hover:underline"
              >
                {t("전체 기록", "All records")}
              </button>
            </div>
          )}
        </>
      )}

      {savedFeedback && (
        <div className="home-chat-turn flex flex-col gap-0.5">
          <SavedScheduleFeedback
            feedback={savedFeedback}
            onEdit={onEditSavedSchedule}
          />
        </div>
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
