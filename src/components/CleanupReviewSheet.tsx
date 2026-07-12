import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { useT, useLang } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";
import {
  detectJunk,
  junkReasonLabel,
  type JunkCandidate,
} from "@/lib/junkDetect";
import { confirm as confirmHaptic } from "@/lib/haptics";

type Props = {
  items: InboxItem[];
  open: boolean;
  onClose: () => void;
  onConfirmDelete: (ids: string[]) => void;
};

type Mode = "suggested" | "all";

export function CleanupReviewSheet({
  items,
  open,
  onClose,
  onConfirmDelete,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const candidates = useMemo(() => detectJunk(items), [items]);
  const [mode, setMode] = useState<Mode>("suggested");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const junkIds = detectJunk(items).map((c) => c.item.id);
    setMode(junkIds.length > 0 ? "suggested" : "all");
    setSelected(new Set(junkIds.length > 0 ? junkIds : items.map((i) => i.id)));
  }, [open, items]);

  if (!open) return null;

  const listItems: JunkCandidate[] =
    mode === "suggested"
      ? candidates
      : items.map((item) => ({ item, reason: "all" as const }));

  const allSelected =
    listItems.length > 0 && listItems.every((c) => selected.has(c.item.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(listItems.map((c) => c.item.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const confirm = () => {
    confirmHaptic();
    onConfirmDelete([...selected]);
    onClose();
  };

  const confirmDeleteAll = () => {
    const ok = window.confirm(
      t(
        `생각 ${items.length}개를 모두 비울까요?`,
        `Let go of all ${items.length} thoughts?`,
      ),
    );
    if (!ok) return;
    confirmHaptic();
    onConfirmDelete(items.map((i) => i.id));
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="85dvh">
      <div className="flex max-h-[85vh] min-h-0 flex-col">
        <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <h2 className="text-[17px] font-bold text-ink">
            {t("가볍게 비울까요?", "Lighten up a little?")}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {mode === "suggested"
              ? t(
                  "비워도 괜찮아 보이는 것만 골라봤어요. 남기고 싶은 건 체크를 해제하세요.",
                  "These look safe to let go. Uncheck anything you want to keep.",
                )
              : t(
                  "남길 것만 체크 해제하세요. 모두 비우려면 아래를 눌러 주세요.",
                  "Uncheck what you want to keep. Use below to let go of everything.",
                )}
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("suggested");
                setSelected(new Set(candidates.map((c) => c.item.id)));
              }}
              className={`flex-1 rounded-full py-2.5 text-[13px] font-bold transition ${
                mode === "suggested"
                  ? "bg-primary text-ink shadow-card"
                  : "bg-ink/[0.05] text-ink-soft"
              }`}
            >
              {t("추천", "Suggested")}
              {candidates.length > 0 ? ` (${candidates.length})` : ""}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("all");
                setSelected(new Set(items.map((i) => i.id)));
              }}
              className={`flex-1 rounded-full py-2.5 text-[13px] font-bold transition ${
                mode === "all"
                  ? "bg-primary text-ink shadow-card"
                  : "bg-ink/[0.05] text-ink-soft"
              }`}
            >
              {t("전체", "All")} ({items.length})
            </button>
          </div>

          {listItems.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={allSelected ? clearSelection : selectAllVisible}
                className="text-[13px] font-semibold text-ink-soft touch-press"
              >
                {allSelected
                  ? t("모두 해제", "Clear picks")
                  : t("모두 고르기", "Pick all")}
              </button>
              <span className="text-[12px] tabular-nums text-ink-soft">
                {selected.size}/{listItems.length}
              </span>
            </div>
          )}

          {listItems.length === 0 ? (
            <p className="mt-6 text-center text-sm text-ink-soft">
              {t(
                "추천할 항목이 없어요. 「전체」에서 고르거나 전체 삭제를 사용하세요.",
                "Nothing suggested. Use All or delete everything.",
              )}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {listItems.map((c) => (
                <CandidateRow
                  key={c.item.id}
                  candidate={c}
                  checked={selected.has(c.item.id)}
                  onToggle={() => toggle(c.item.id)}
                  lang={lang}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="sheet-cta-bar shrink-0 space-y-2 border-t border-ink/[0.08] bg-white/98 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full bg-ink/[0.06] py-3.5 text-[15px] font-semibold text-ink touch-press"
            >
              {t("취소", "Cancel")}
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={selected.size === 0}
              className="flex-1 rounded-full bg-ink py-3.5 text-[15px] font-bold text-white disabled:opacity-40 touch-press"
            >
              {selected.size > 0
                ? t(`비우기 (${selected.size})`, `Let go (${selected.size})`)
                : t("비우기", "Let go")}
            </button>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={confirmDeleteAll}
              className="w-full py-2 text-[13px] font-semibold text-red-600 touch-press"
            >
              {t(`모두 비우기 (${items.length})`, `Let go of all (${items.length})`)}
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

function CandidateRow({
  candidate,
  checked,
  onToggle,
  lang,
}: {
  candidate: JunkCandidate | { item: InboxItem; reason: "all" | JunkCandidate["reason"] };
  checked: boolean;
  onToggle: () => void;
  lang: "ko" | "en";
}) {
  const locale = lang === "en" ? "en-US" : "ko-KR";
  const preview =
    candidate.item.text.trim() || (candidate.item.images?.length ? "🖼" : "—");

  const reasonLine =
    candidate.reason === "all"
      ? new Date(candidate.item.created_at).toLocaleString(locale, {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : junkReasonLabel(candidate.reason, lang);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-start gap-3 rounded-[20px] px-3.5 py-3 text-left transition ${
          checked ? "bg-ink/[0.06]" : "bg-white shadow-card"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
            checked ? "border-ink bg-ink text-white" : "border-ink/20"
          }`}
          aria-hidden
        >
          {checked ? "✓" : ""}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{preview}</p>
          <p className="mt-0.5 text-[11px] text-ink-soft">{reasonLine}</p>
        </div>
      </button>
    </li>
  );
}
