import { useEffect, useRef } from "react";
import {
  DecisionDeck,
  type DecisionMeta,
  type DecisionResult,
  type UndoSnapshot,
} from "@/components/DecisionDeck";
import { useLang, useT } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { tap } from "@/lib/haptics";
import type { DecisionOutcome, InboxItem } from "@/lib/store";
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

export function DecisionLauncher({
  open,
  startItemId,
  items,
  onClose,
  onCapture,
  onDecide,
  onUndo,
}: DeckProps) {
  const sessionItemsRef = useRef<InboxItem[]>(items);
  const wasOpenRef = useRef(false);

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

  const handleDecideSafely = async (
    outcome: DecisionOutcome,
    item: InboxItem,
    meta: DecisionMeta,
  ): Promise<DecisionResult | void> => {
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
    <DecisionDeck
      open={open}
      startItemId={startItemId}
      items={open ? sessionItemsRef.current : items}
      onClose={onClose}
      onCapture={onCapture}
      onDecide={handleDecideSafely}
      onUndo={handleUndoSafely}
    />
  );
}
