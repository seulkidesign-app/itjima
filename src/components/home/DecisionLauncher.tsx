import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
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
import type { DecisionOutcome, InboxItem } from "@/lib/store";
import { withInboxScheduleDraft } from "@/lib/inboxScheduleDefaults";
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
        ? "One thought is ready"
        : `${itemCount} thoughts are ready`
      : itemCount === 1
        ? "생각 하나가 기다리고 있어요"
        : `생각 ${itemCount}개가 기다리고 있어요`;
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
      className="decision-launcher-bar touch-press mx-3 mb-1 mt-2 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-[20px] border border-ink/[0.07] bg-white px-3 py-2.5 text-left shadow-card transition-transform active:scale-[0.99]"
    >
      <span className="decision-launcher-symbol relative grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-primary text-ink">
        <Sparkles size={20} strokeWidth={2.15} aria-hidden />
        <span
          className="decision-launcher-count-badge absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] font-black text-white"
          aria-hidden
        >
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <strong
          className="block truncate text-[13px] font-bold tracking-[-0.015em] text-ink"
          data-testid="decision-launcher-count"
        >
          {label}
        </strong>
        <span className="mt-0.5 block truncate text-[11px] font-medium text-ink-soft">
          {t(
            "카드를 넘기며 일정·보관·나중으로 정리해요",
            "Swipe each card into schedule, archive, or later",
          )}
        </span>
      </span>
      <span className="decision-launcher-cta inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-ink px-3 text-[11px] font-bold text-white">
        {t("정리", "Sort")}
        <ArrowUpRight size={14} aria-hidden />
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
  const sessionItemsRef = useRef<InboxItem[]>(items);
  const wasOpenRef = useRef(false);
  const [pendingSchedule, setPendingSchedule] =
    useState<PendingScheduleDecision | null>(null);

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

    const configuredItem = withInboxScheduleDraft(pending.item, {
      text,
      start,
      end,
      options,
    });
    const before = captureDecisionStorage(pending.item.id);

    try {
      const result = await onDecide("today", configuredItem, pending.meta);
      track("schedule_setup_confirmed", {
        source: "decision_deck",
        position: pending.meta.position,
        total: pending.meta.total,
      });
      setPendingSchedule(null);
      pending.resolve(result ?? {});
    } catch (error) {
      const recovered = recoverLocallyCommittedDecision(
        "today",
        pending.item.id,
        before,
      );
      if (recovered) {
        setPendingSchedule(null);
        pending.resolve(recovered);
        return;
      }
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
