import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";

type PasteSheetState = {
  chunks: string[];
  original: string;
};

type Props = {
  pasteSheet: PasteSheetState;
  onDismiss: () => void;
  onKeepSeparately: () => void | Promise<void>;
  onKeepAsOne: () => void | Promise<void>;
};

export function PasteSheet({
  pasteSheet,
  onDismiss,
  onKeepSeparately,
  onKeepAsOne,
}: Props) {
  const t = useT();

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      onClick={onDismiss}
    >
      <div className="flex-1 bg-ink/30 backdrop-blur-sm animate-fade-in" />
      <div
        className="glass-strong animate-slide-up rounded-t-[28px] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />
        <div className="text-[17px] font-bold text-ink">
          {t(
            "붙여넣은 글, 어떻게 남길까요?",
            "How should we keep this pasted text?",
          )}
        </div>
        <div className="mt-1 text-sm text-ink-soft">
          {t(
            `${pasteSheet.chunks.length}줄이에요.`,
            `${pasteSheet.chunks.length} lines here.`,
          )}
        </div>
        <button
          onClick={() => void onKeepSeparately()}
          className="mt-4 w-full rounded-full bg-primary py-3.5 text-[15px] font-bold text-ink"
        >
          {t("나눠서 남기기", "Keep separately")}
        </button>
        <button
          onClick={() => void onKeepAsOne()}
          className="mt-2 w-full rounded-full bg-white/70 py-3.5 text-[15px] font-semibold text-ink"
        >
          {t("한 덩어리로 남기기", "Keep as one")}
        </button>
      </div>
    </div>
  );
}
