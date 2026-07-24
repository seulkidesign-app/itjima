import { DecisionDeck } from "@/components/DecisionDeck";
import { useLang, useT } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { tap } from "@/lib/haptics";
import type { InboxItem } from "@/lib/store";

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

  const countLabel = lang === "en" ? String(itemCount) : `${itemCount}개`;
  const ariaLabel =
    lang === "en"
      ? `Decide one by one, ${itemCount} thoughts`
      : `하나씩 결정하기, ${itemCount}개`;

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
      className="touch-press mx-3 mb-2 mt-2 flex w-[calc(100%-1.5rem)] items-center justify-between gap-3 rounded-[20px] border border-ink/8 bg-[#fafaf8] px-4 py-3 text-left shadow-card transition-transform active:scale-[0.99]"
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[-0.01em] text-ink-soft">
          {t("결정할 생각", "Thoughts to decide")}
        </p>
        <p
          className="mt-0.5 text-[17px] font-bold tabular-nums tracking-[-0.02em] text-ink"
          data-testid="decision-launcher-count"
        >
          {countLabel}
        </p>
      </div>
      <span className="pill-yellow shrink-0 px-3.5 py-2 text-[12px] font-bold text-ink">
        {t("하나씩 결정하기", "Decide one by one")}
      </span>
    </button>
  );
}

type DeckProps = {
  open: boolean;
  startItemId: string | null;
  items: InboxItem[];
  pendingScheduleId: string | null;
  scheduleCommittedId: string | null;
  onScheduleCommitHandled: () => void;
  onClose: () => void;
  onScheduleRequest: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void | Promise<void>;
};

export function DecisionLauncher({
  open,
  startItemId,
  items,
  pendingScheduleId,
  scheduleCommittedId,
  onScheduleCommitHandled,
  onClose,
  onScheduleRequest,
  onArchive,
}: DeckProps) {
  return (
    <DecisionDeck
      open={open}
      startItemId={startItemId}
      items={items}
      pendingScheduleId={pendingScheduleId}
      scheduleCommittedId={scheduleCommittedId}
      onScheduleCommitHandled={onScheduleCommitHandled}
      onClose={onClose}
      onScheduleRequest={onScheduleRequest}
      onArchive={onArchive}
    />
  );
}
