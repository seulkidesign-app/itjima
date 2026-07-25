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
      : `${itemCount}개의 생각이 기다리고 있어요`;
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
      className="touch-press mx-3 mb-0.5 mt-2 flex w-[calc(100%-1.5rem)] items-center justify-between gap-2 rounded-[var(--radius-md)] border border-ink/[0.06] bg-white/80 px-3 py-1.5 text-left shadow-[0_1px_2px_oklch(0_0_0/0.03)] transition-transform active:scale-[0.99]"
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
