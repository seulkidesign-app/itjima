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
  onConfirmScheduleQuick: (item: InboxItem) => void | Promise<void>;
  onSchedule: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onLetGo: (item: InboxItem) => void | Promise<void>;
  onDismiss: () => void;
};

export function InlinePromise({
  item,
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
    switch (c.primaryAction) {
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT_APP }}
      className="mx-4 mb-3 rounded-[24px] border border-ink/[0.06] bg-white px-4 py-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]"
      data-testid="inline-promise"
    >
      <p className="text-[12px] font-semibold text-primary">
        {t("잊지마", "Itjima")}
      </p>
      <p className="mt-2 text-[15px] font-semibold leading-snug text-ink">
        {card.label}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
        {card.promise}
      </p>
      <p className="mt-2 text-[12px] font-medium text-ink/70">
        {t("저장됨", "Saved")}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          data-testid="promise-primary"
          onClick={() => void runPrimary(card)}
          className="pill-yellow touch-press min-h-[44px] flex-1 px-3 py-2.5 text-[13px] font-bold text-ink"
        >
          {card.primaryActionLabel}
        </button>
        <button
          type="button"
          data-testid="promise-edit"
          onClick={() => runEdit(card)}
          className="touch-press min-h-[44px] rounded-full border border-ink/12 bg-white px-4 py-2.5 text-[13px] font-semibold text-ink"
        >
          {card.editActionLabel}
        </button>
      </div>

      {editOpen && (
        <div
          className="mt-2 rounded-[18px] border border-ink/8 bg-[#fafaf8] p-1"
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
      className="touch-press w-full rounded-[14px] px-3 py-3 text-left text-[13px] font-medium text-ink active:bg-white"
    >
      {label}
    </button>
  );
}
