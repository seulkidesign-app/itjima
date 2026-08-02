import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DecisionDeck,
  type DecisionMeta,
  type DecisionResult,
  type UndoSnapshot,
} from "@/components/DecisionDeck";
import { FocusScheduleSheet } from "@/components/FocusScheduleSheet";
import type { ScheduleConfirmOptions } from "@/components/ScheduleChoiceFlow";
import { useLang, useT } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { tap } from "@/lib/haptics";
import {
  useInbox,
  useSchedules,
  type DecisionOutcome,
  type InboxItem,
} from "@/lib/store";
import { scheduleFromInbox } from "@/lib/thoughtProvenance";
import { allCloudSynced } from "@/lib/syncFeedback";
import {
  captureDecisionStorage,
  clearInboxTombstones,
  recoverLocallyCommittedDecision,
  undoLocallyCommitted,
} from "@/lib/decisionRecovery";

type CardProps = {
  itemCount: number;
  newestItemId: string | undefined;
  onOpen: (startItemId: string | undefined) => void;
};

export function DecisionLauncherCard({
  itemCount,
  newestItemId,
  onOpen,
}: CardProps) {
  const t = useT();
  const { lang } = useLang();

  if (itemCount < 1) return null;

  const label =
    lang === "en"
      ? itemCount === 1
        ? "1 thought waiting"
        : `${itemCount} thoughts waiting for you`
      : itemCount === 1
        ? "하나, 정리해 볼까요?"
        : `${itemCount}개, 정리해 볼까요?`;
  const ariaLabel =
    lang === "en"
      ? `Sort ${itemCount} thoughts`
      : `정리하기, ${itemCount}개`;

  const handleClick = () => {
    tap();
    track("decision_started", {
      item_count: itemCount,
      source: "home_launcher",
    });
    onOpen(newestItemId);
  };

  return (
    <button
      type="button"
      data-testid="decision-launcher"
      aria-label={ariaLabel}
      onClick={handleClick}
      className="decision-launcher-bar touch-press mx-3 mb-0.5 mt-2 flex w-[calc(100%-1.5rem)] items-center justify-between gap-2 rounded-[var(--radius-md)] border border-ink/[0.06] bg-white/80 px-3 py-1.5 text-left shadow-[0_1px_2px_oklch(0_0_0/0.03)] transition-transform active:scale-[0.99]"
    >
      <p
        className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-ink"
        data-testid="decision-launcher-count"
      >
        {label}
      </p>
      <span className="pill-yellow shrink-0 px-3 py-1.5 text-[11px] font-bold text-ink">
        {t("정리하기", "Sort them")}
      </span>
    </button>
  );
}

type DeckProps = {
  open: boolean;
  startItemId: string | null;
  items: InboxItem[];
  onClose: () => void;
  onCapture?: () => void;
  onDecide: (
    outcome: DecisionOutcome,
    item: InboxItem,
    meta: DecisionMeta,
  ) => Promise<DecisionResult | void>;
  onUndo: (snapshot: UndoSnapshot) => Promise<void>;
};

type PendingScheduleDecision = {
  item: InboxItem;
  meta: DecisionMeta;
  resolve: (result: DecisionResult) => void;
  reject: (reason?: unknown) => void;
};

export function DecisionLauncher({
  open,
  startItemId,
  items,
  onClose,
  onCapture,
  onDecide,
  onUndo,
}: DeckProps) {
  const t = useT();
  const inbox = useInbox();
  const schedules = useSchedules();
  const sessionItemsRef = useRef<InboxItem[]>(items);
  const wasOpenRef = useRef(false);
  const [pendingSchedule, setPendingSchedule] =
    useState<PendingScheduleDecision | null>(null);

  // Freeze the card list for one sorting session. Parent storage updates after a
  // decision must not prune the deck a second time and skip the next card.
  if (open && !wasOpenRef.current) {
    sessionItemsRef.current = [...items];
  } else if (!open) {
    sessionItemsRef.current = [...items];
  }

  useEffect(() => {
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (open || !pendingSchedule) return;
    pendingSchedule.reject(new Error("schedule_setup_cancelled"));
    setPendingSchedule(null);
  }, [open, pendingSchedule]);

  const requestScheduleSetup = (
    item: InboxItem,
    meta: DecisionMeta,
  ): Promise<DecisionResult> =>
    new Promise((resolve, reject) => {
      track("schedule_setup_opened", {
        source: "decision_deck",
        position: meta.position,
        total: meta.total,
      });
      setPendingSchedule({ item, meta, resolve, reject });
    });

  const commitConfiguredSchedule = async (
    text: string,
    start: Date,
    end: Date,
    options: ScheduleConfirmOptions,
  ) => {
    const pending = pendingSchedule;
    if (!pending) return;

    try {
      const payload = scheduleFromInbox(pending.item, {
        text,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        alarm: options.reminderMinutes !== null,
        all_day: options.allDay,
        start_all_day: options.startAllDay,
        end_all_day: options.endAllDay,
        repeat: options.repeat,
      });
      const { item: created, cloudSynced: scheduleSynced } =
        await schedules.add({
          ...payload,
          ...(options.reminderMinutes !== null
            ? {
                alarm_at: new Date(
                  start.getTime() - options.reminderMinutes * 60 * 1000,
                ).toISOString(),
              }
            : {}),
        });
      const inboxSynced = await inbox.remove(pending.item.id);
      if (!allCloudSynced(scheduleSynced, inboxSynced)) {
        throw new Error("sync_failed");
      }

      track("schedule_created", {
        source: "decision_deck_configured",
        text_length: text.length,
      });
      setPendingSchedule(null);
      pending.resolve({ scheduleId: created.id });
    } catch {
      toast.error(
        t(
          "일정을 저장하지 못했어요. 다시 시도해 주세요.",
          "Couldn't save the schedule. Try again.",
        ),
      );
    }
  };

  const cancelScheduleSetup = () => {
    const pending = pendingSchedule;
    if (!pending) return;
    setPendingSchedule(null);
    pending.reject(new Error("schedule_setup_cancelled"));
  };

  const handleDecideSafely = async (
    outcome: DecisionOutcome,
    item: InboxItem,
    meta: DecisionMeta,
  ): Promise<DecisionResult | void> => {
    if (outcome === "today") {
      return requestScheduleSetup(item, meta);
    }

    const before = captureDecisionStorage(item.id);
    try {
      return await onDecide(outcome, item, meta);
    } catch (error) {
      const recovered = recoverLocallyCommittedDecision(outcome, item.id, before);
      if (recovered) return recovered;
      throw error;
    }
  };

  const handleUndoSafely = async (snapshot: UndoSnapshot) => {
    // A failed cloud delete may have queued a tombstone. Undo means that
    // tombstone is no longer valid, even when the original row still exists.
    clearInboxTombstones(snapshot.item.id);
    try {
      await onUndo(snapshot);
    } catch (error) {
      if (!undoLocallyCommitted(snapshot)) throw error;
    } finally {
      clearInboxTombstones(snapshot.item.id);
    }
  };

  return (
    <>
      <DecisionDeck
        open={open}
        startItemId={startItemId}
        items={open ? sessionItemsRef.current : items}
        onClose={onClose}
        onCapture={onCapture}
        onDecide={handleDecideSafely}
        onUndo={handleUndoSafely}
      />

      <FocusScheduleSheet
        item={pendingSchedule?.item ?? null}
        open={Boolean(pendingSchedule)}
        onClose={cancelScheduleSetup}
        onConfirm={(text, start, end, options) => {
          void commitConfiguredSchedule(text, start, end, options);
        }}
      />
    </>
  );
}
