import { useEffect, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { useT, useLang } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";
import { detectJunk, junkReasonLabel, type JunkCandidate } from "@/lib/junkDetect";

type Props = {
  items: InboxItem[];
  open: boolean;
  onClose: () => void;
  onConfirmDelete: (ids: string[]) => void;
};

export function CleanupReviewSheet({ items, open, onClose, onConfirmDelete }: Props) {
  const t = useT();
  const { lang } = useLang();
  const candidates = detectJunk(items);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setSelected(new Set(detectJunk(items).map((c) => c.item.id)));
  }, [open, items]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    onConfirmDelete([...selected]);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80vh">
      <div className="max-h-[calc(80vh-3rem)] overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <h2 className="text-[17px] font-bold text-ink">
          {t("삭제해도 될 것 같아요", "These look safe to remove")}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {t(
            "의미 없는 입력만 골라봤어요. 남길 건 체크 해제하세요.",
            "We picked likely junk. Uncheck anything you want to keep.",
          )}
        </p>

        {candidates.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink-soft">
            {t("지금은 정리할 항목이 없어요.", "Nothing to clean up right now.")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {candidates.map((c) => (
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

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-white/70 py-3.5 text-[15px] font-semibold text-ink touch-press"
          >
            {t("취소", "Cancel")}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={selected.size === 0}
            className="flex-1 rounded-full bg-ink py-3.5 text-[15px] font-bold text-white disabled:opacity-40 touch-press"
          >
            {t("삭제하기", "Delete")}
          </button>
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
  candidate: JunkCandidate;
  checked: boolean;
  onToggle: () => void;
  lang: "ko" | "en";
}) {
  const preview =
    candidate.item.text.trim() ||
    (candidate.item.images?.length ? "🖼" : "—");

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-start gap-3 rounded-[20px] px-3.5 py-3 text-left transition ${
          checked ? "bg-ink/[0.06]" : "bg-white shadow-card"
        }`}
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
          <p className="mt-0.5 text-[11px] text-ink-soft">
            {junkReasonLabel(candidate.reason, lang)}
          </p>
        </div>
      </button>
    </li>
  );
}
