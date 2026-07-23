import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLang, useT } from "@/lib/i18n";
import {
  buildPromiseCard,
  type PromiseCard,
  type PromisePrimaryAction,
} from "@/lib/promiseCard";
import type { InboxItem } from "@/lib/store";
import { confirm as confirmHaptic, haptic } from "@/lib/haptics";
import { EASE_OUT_APP } from "@/lib/motion";

type Props = {
  item: InboxItem;
  acknowledged?: boolean;
  onConfirmScheduleQuick: (item: InboxItem) => void | Promise<void>;
  onSchedule: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onLetGo: (item: InboxItem) => void | Promise<void>;
  onDismiss: () => void;
};

export function InlinePromise({
  item,
  acknowledged = false,
  onConfirmScheduleQuick,
  onSchedule,
  onArchive,
  onLetGo,
  onDismiss,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const [editOpen, setEditOpen] = useState(false);
  const card = useMemo(
    () => buildPromiseCard(item.text, lang === "en" ? "en" : "ko"),
    [item.text, lang],
  );

  const runPrimary = async (c: PromiseCard) => {
    confirmHaptic();
    switch (c.primaryAction as PromisePrimaryAction) {
      case "confirm_schedule":
        await onConfirmScheduleQuick(item);
        break;
      case "set_resurface":
        onSchedule(item);
        break;
      case "archive":
        await onArchive(item);
        onDismiss();
        break;
      case "keep_task":
      case "keep_note":
        onDismiss();
        break;
    }
  };

  const runEdit = (c: PromiseCard) => {
    if (c.editAction === "open_schedule_sheet") {
      confirmHaptic();
      onSchedule(item);
      return;
    }
    haptic(6);
    setEditOpen((v) => !v);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT_APP }}
      className="flex w-full max-w-[min(300px,88%)] flex-col items-start"
      data-testid="inline-promise"
    >
      <span className="mb-1 px-0.5 text-[11px] font-semibold text-ink-soft">
        {t("잊지마", "Itjima")}
      </span>
      <div className="itjima-reply-bubble w-full px-3.5 py-2.5">
        <p className="line-clamp-1 text-[14px] font-semibold leading-snug text-ink">
          {card.icon} {card.label}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[13px] leading-snug text-ink-soft">
          {card.promise}
        </p>
      </div>

      {!acknowledged && (
        <div className="mt-2 flex w-full gap-2" data-testid="promise-actions">
          <button
            type="button"
            data-testid="promise-primary"
            onClick={() => void runPrimary(card)}
            className="pill-yellow touch-press min-h-[40px] flex-1 px-2.5 py-2 text-[12px] font-bold text-ink"
          >
            {card.primaryActionLabel}
          </button>
          <button
            type="button"
            data-testid="promise-edit"
            onClick={() => runEdit(card)}
            className="touch-press min-h-[40px] shrink-0 rounded-full border border-ink/12 bg-white px-3.5 py-2 text-[12px] font-semibold text-ink"
          >
            {card.editActionLabel}
          </button>
        </div>
      )}

      {!acknowledged && editOpen && (
        <div
          className="mt-2 w-full rounded-[16px] border border-ink/8 bg-[#fafaf8] p-1"
          data-testid="promise-edit-menu"
        >
          <EditRow
            label={t("일정으로 잡기", "Set a time")}
            onClick={() => onSchedule(item)}
          />
          <EditRow
            label={t("생각 보관함에 보관", "Save to vault")}
            onClick={() => {
              void Promise.resolve(onArchive(item)).then(onDismiss);
            }}
          />
          <EditRow
            label={t("내려놓기", "Let go")}
            onClick={() => {
              void Promise.resolve(onLetGo(item)).then(onDismiss);
            }}
          />
          <EditRow label={t("그대로 두기", "Keep here")} onClick={onDismiss} />
        </div>
      )}
    </motion.div>
  );
}

function EditRow({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-press w-full rounded-[12px] px-3 py-2.5 text-left text-[13px] font-medium text-ink active:bg-white"
    >
      {label}
    </button>
  );
}
