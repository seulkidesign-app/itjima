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
      ? `${itemCount} thoughts to decide`
      : `결정할 생각 ${itemCount}개`;
  const ariaLabel =
    lang === "en"
      ? `Decide, ${itemCount} thoughts`
      : `결정하기, ${itemCount}개`;

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
      className="touch-press mx-3 mb-1.5 mt-1.5 flex w-[calc(100%-1.5rem)] items-center justify-between gap-3 rounded-[16px] border border-ink/8 bg-[#fafaf8] px-3.5 py-2 text-left shadow-card transition-transform active:scale-[0.99]"
    >
      <p
        className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-ink"
        data-testid="decision-launcher-count"
      >
        {label}
      </p>
      <span className="pill-yellow shrink-0 px-3 py-1.5 text-[11px] font-bold text-ink">
        {t("결정하기", "Decide")}
      </span>
    </button>
  );
}

type DeckProps = {
  open: boolean;
  startItemId: string | null;
  items: InboxItem[];
  onClose: () => void;
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
  onDecide,
  onUndo,
}: DeckProps) {
  return (
    <DecisionDeck
      open={open}
      startItemId={startItemId}
      items={items}
      onClose={onClose}
      onDecide={onDecide}
      onUndo={onUndo}
    />
  );
}
