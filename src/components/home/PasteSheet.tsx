import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";

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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      primaryRef.current?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
      });
    };
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" role="presentation">
      <button
        type="button"
        aria-label={t("붙여넣기 선택 닫기", "Close paste options")}
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm animate-fade-in"
        onClick={onDismiss}
      />
      <div
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="paste-sheet-title"
        aria-describedby="paste-sheet-description"
        className="glass-strong relative mt-auto animate-slide-up rounded-t-[28px] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" aria-hidden />
        <h2 id="paste-sheet-title" className="text-[17px] font-bold text-ink">
          {t(
            "붙여넣은 글, 어떻게 나눌까요?",
            "How should we split this paste?",
          )}
        </h2>
        <p id="paste-sheet-description" className="mt-1 text-sm text-ink-soft">
          {t(
            `${pasteSheet.chunks.length}줄이에요.`,
            `${pasteSheet.chunks.length} lines here.`,
          )}
        </p>
        <button
          ref={primaryRef}
          type="button"
          onClick={() => void onKeepSeparately()}
          className="touch-press mt-4 min-h-11 w-full rounded-full bg-primary px-4 text-[15px] font-bold text-ink"
        >
          {t("각각 따로 남기기", "Capture each separately")}
        </button>
        <button
          type="button"
          onClick={() => void onKeepAsOne()}
          className="touch-press mt-2 min-h-11 w-full rounded-full bg-white/70 px-4 text-[15px] font-semibold text-ink"
        >
          {t("한 번에 남기기", "Capture as one")}
        </button>
      </div>
    </div>
  );
}
