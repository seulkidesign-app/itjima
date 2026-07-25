import { useEffect, useMemo, useRef, useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import {
  trackClarifyOpened,
  trackIntentConfirmed,
  trackIntentCorrected,
  trackIntentPredicted,
  trackManualFallbackUsed,
} from "@/lib/nlAnalytics";
import {
  buildPromiseCard,
  type PromiseCard,
  type PromisePrimaryAction,
} from "@/lib/promiseCard";
import {
  clarifyPicksForText,
  type ClarifyPick,
  type NlIntent,
} from "@/lib/nlSchedule";
import type { InboxItem } from "@/lib/store";
import { confirm as confirmHaptic, haptic, tick } from "@/lib/haptics";

type CorrectableIntent = "schedule" | "task" | "archive" | "keep";

type Props = {
  item: InboxItem;
  acknowledged?: boolean;
  compact?: boolean;
  onConfirmScheduleQuick: (item: InboxItem) => void | Promise<void>;
  onConfirmClarify: (
    item: InboxItem,
    pick: ClarifyPick,
  ) => void | Promise<void>;
  onConfirmTaskLater: (item: InboxItem) => void | Promise<void>;
  onOpenManualSchedule: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onLetGo: (item: InboxItem) => void | Promise<void>;
  onDismiss: () => void;
};

const INTENT_BADGE: Record<
  PromiseCard["nlIntent"],
  { ko: string; en: string }
> = {
  schedule_exact: { ko: "일정", en: "Schedule" },
  schedule_clarify: { ko: "일정 · 확인 필요", en: "Schedule · needs a moment" },
  task: { ko: "할 일", en: "Task" },
  archive: { ko: "보관", en: "Vault" },
  keep: { ko: "메모", en: "Note" },
};

export function NlSchedulePrompt({
  item,
  acknowledged = false,
  compact = false,
  onConfirmScheduleQuick,
  onConfirmClarify,
  onConfirmTaskLater,
  onOpenManualSchedule,
  onArchive,
  onLetGo,
  onDismiss,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";
  const [editOpen, setEditOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const [privacyAcked, setPrivacyAcked] = useState(false);
  const trackedRef = useRef(false);

  const card = useMemo(
    () => buildPromiseCard(item.text, uiLang),
    [item.text, uiLang],
  );
  const clarifyOptions = useMemo(
    () => clarifyPicksForText(item.text, uiLang),
    [item.text, uiLang],
  );
  const badge = INTENT_BADGE[card.nlIntent];

  useEffect(() => {
    if (acknowledged || trackedRef.current) return;
    trackedRef.current = true;
    trackIntentPredicted(card.nlIntent, card.confidenceLevel);
    if (card.showClarifyChips) trackClarifyOpened();
  }, [acknowledged, card.confidenceLevel, card.nlIntent, card.showClarifyChips]);

  const runPrimary = async (c: PromiseCard, corrected = false) => {
    if (c.isSensitive && c.nlIntent === "archive" && !privacyAcked) {
      setPrivacyAcked(true);
      return;
    }
    confirmHaptic();
    switch (c.primaryAction as PromisePrimaryAction) {
      case "confirm_schedule":
        await onConfirmScheduleQuick(item);
        trackIntentConfirmed("schedule_exact", corrected);
        onDismiss();
        break;
      case "clarify_schedule":
        await onConfirmClarify(item, clarifyOptions[0]?.pick ?? "weekend");
        trackIntentConfirmed("schedule_clarify", corrected);
        onDismiss();
        break;
      case "confirm_task_later":
        await onConfirmTaskLater(item);
        trackIntentConfirmed("task", corrected);
        onDismiss();
        break;
      case "archive":
        await onArchive(item);
        trackIntentConfirmed("archive", corrected);
        onDismiss();
        break;
      default:
        trackIntentConfirmed("keep", corrected);
        onDismiss();
        break;
    }
  };

  const runCorrected = async (target: CorrectableIntent) => {
    const from = card.nlIntent;
    const toIntent: NlIntent =
      target === "schedule"
        ? "schedule_exact"
        : target === "task"
          ? "task"
          : target === "archive"
            ? "archive"
            : "keep";
    if (from !== toIntent) trackIntentCorrected(from, toIntent);
    setCorrectOpen(false);
    confirmHaptic();

    switch (target) {
      case "schedule":
        if (card.detectedDate) {
          await onConfirmScheduleQuick(item);
          trackIntentConfirmed("schedule_exact", true);
          onDismiss();
        } else {
          trackManualFallbackUsed(from);
          onOpenManualSchedule(item);
        }
        break;
      case "task":
        await onConfirmTaskLater(item);
        trackIntentConfirmed("task", true);
        onDismiss();
        break;
      case "archive":
        if (card.isSensitive && !privacyAcked) {
          setPrivacyAcked(true);
          return;
        }
        await onArchive(item);
        trackIntentConfirmed("archive", true);
        onDismiss();
        break;
      case "keep":
        trackIntentConfirmed("keep", true);
        onDismiss();
        break;
    }
  };

  const runManual = () => {
    confirmHaptic();
    trackManualFallbackUsed(card.nlIntent);
    onOpenManualSchedule(item);
  };

  const runTaskAddDate = () => {
    confirmHaptic();
    trackManualFallbackUsed("task");
    onOpenManualSchedule(item);
  };

  const primaryLabel =
    card.isSensitive && card.nlIntent === "archive" && privacyAcked
      ? t("보관함에 맡기기", "Save to vault")
      : card.primaryActionLabel;

  return (
    <div
      className={
        compact
          ? "w-full"
          : "flex w-full max-w-[min(300px,88%)] flex-col items-start"
      }
      data-testid="inline-promise"
      data-intent={card.nlIntent}
      data-confidence={card.confidenceLevel}
      data-sensitive={card.isSensitive ? "true" : "false"}
    >
      <div className="mb-1.5 flex w-full items-center gap-2 px-0.5">
        <span className="text-[11px] font-semibold text-ink-soft">
          {t("이해했어요", "Got it")}
        </span>
        <span className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
          {t(badge.ko, badge.en)}
        </span>
        {!acknowledged && (
          <button
            type="button"
            data-testid="promise-correct"
            onClick={() => {
              haptic(6);
              setCorrectOpen((v) => !v);
              setEditOpen(false);
            }}
            className="ml-auto text-[10px] font-medium text-ink-soft underline decoration-ink/20 underline-offset-2"
          >
            {t("다르게 이해했나요?", "Not quite?")}
          </button>
        )}
      </div>

      <div className="brain-mirror-card w-full px-3.5 py-2.5">
        <p className="line-clamp-3 text-[14px] font-semibold leading-snug text-ink">
          {card.icon} {card.label}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-soft">
          {card.promise}
        </p>
      </div>

      {card.isSensitive && card.nlIntent === "archive" && (
        <p
          className="mt-2 w-full rounded-[12px] bg-ink/[0.04] px-3 py-2 text-[11px] leading-snug text-ink-soft"
          data-testid="promise-privacy-warning"
        >
          {privacyAcked
            ? t(
                "기기에만 저장돼요. 한 번 더 누르면 보관함으로 옮길게요.",
                "Stays on your device only. Tap again to save to vault.",
              )
            : t(
                "민감한 내용 같아요. 다른 곳으로 보내지 않고 기기에만 남겨요.",
                "Looks sensitive. We won't send it anywhere — it stays on your device.",
              )}
        </p>
      )}

      {!acknowledged && correctOpen && (
        <div
          className="mt-2 w-full rounded-[16px] border border-ink/8 bg-[#fafaf8] p-1"
          data-testid="promise-correct-menu"
        >
          <CorrectRow
            label={t("일정에 추가", "Add to schedule")}
            onClick={() => void runCorrected("schedule")}
          />
          <CorrectRow
            label={t("할 일로 넣기", "Add as task")}
            onClick={() => void runCorrected("task")}
          />
          <CorrectRow
            label={t("보관함에 맡기기", "Save to vault")}
            onClick={() => void runCorrected("archive")}
          />
          <CorrectRow
            label={t("그대로 두기", "Keep here")}
            onClick={() => void runCorrected("keep")}
          />
        </div>
      )}

      {!acknowledged && card.showClarifyChips && (
        <div
          className="mt-2 grid w-full grid-cols-3 gap-1.5"
          data-testid="promise-clarify-chips"
        >
          {clarifyOptions.map(({ pick, label }) => (
            <button
              key={pick}
              type="button"
              data-testid={`promise-clarify-${pick}`}
              onClick={() => {
                tick();
                void onConfirmClarify(item, pick).then(() => {
                  trackIntentConfirmed("schedule_clarify", false);
                  onDismiss();
                });
              }}
              className="touch-press min-h-[40px] rounded-full border border-ink/10 bg-white px-2 py-2 text-[11px] font-semibold text-ink"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!acknowledged && card.showClarifyChips && (
        <button
          type="button"
          data-testid="promise-keep"
          onClick={onDismiss}
          className="mt-2 w-full py-1 text-center text-[12px] font-medium text-ink-soft"
        >
          {t("그대로 두기", "Keep here")}
        </button>
      )}

      {!acknowledged && (
        <div className="mt-2 flex w-full gap-2" data-testid="promise-actions">
          {!card.showClarifyChips && (
            <button
              type="button"
              data-testid="promise-primary"
              onClick={() => void runPrimary(card)}
              className="pill-yellow touch-press min-h-[40px] flex-1 px-2.5 py-2 text-[12px] font-bold text-ink"
            >
              {primaryLabel}
            </button>
          )}
          {card.nlIntent === "task" ? (
            <button
              type="button"
              data-testid="promise-add-date"
              onClick={runTaskAddDate}
              className="touch-press min-h-[40px] shrink-0 rounded-full border border-ink/12 bg-white px-3.5 py-2 text-[12px] font-semibold text-ink"
            >
              {t("날짜 추가", "Add date")}
            </button>
          ) : (
            <button
              type="button"
              data-testid="promise-manual"
              onClick={() => {
                if (card.showClarifyChips) runManual();
                else {
                  haptic(6);
                  setEditOpen((v) => !v);
                  setCorrectOpen(false);
                }
              }}
              className={`touch-press min-h-[40px] shrink-0 rounded-full border border-ink/12 bg-white px-3.5 py-2 text-[12px] font-semibold text-ink ${
                card.showClarifyChips ? "flex-1" : ""
              }`}
            >
              {card.showClarifyChips
                ? t("날짜 고르기", "Pick a date")
                : card.editActionLabel}
            </button>
          )}
        </div>
      )}

      {!acknowledged && editOpen && !card.showClarifyChips && card.nlIntent !== "task" && (
        <div
          className="mt-2 w-full rounded-[16px] border border-ink/8 bg-[#fafaf8] p-1"
          data-testid="promise-edit-menu"
        >
          <EditRow
            label={t("날짜 고르기", "Pick a date")}
            onClick={runManual}
          />
          <EditRow
            label={t("할 일로 넣기", "Add as task")}
            onClick={() => void runCorrected("task")}
          />
          <EditRow
            label={t("보관함에 맡기기", "Save to vault")}
            onClick={() => void runCorrected("archive")}
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
    </div>
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

function CorrectRow({
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
