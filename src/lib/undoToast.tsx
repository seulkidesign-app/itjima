import { toast } from "sonner";

const toastSurface =
  "flex items-center gap-3 rounded-[20px] border border-ink/10 bg-white/96 px-4 py-3.5 text-ink shadow-float backdrop-blur-sm";

/** Soft recovery control — never brand-yellow primary. */
const undoBtn =
  "touch-press shrink-0 inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-ink/[0.04] px-3.5 text-[13px] font-semibold text-ink";

const secondaryBtn =
  "touch-press shrink-0 inline-flex min-h-11 items-center justify-center rounded-full px-3 text-[13px] font-semibold text-ink-soft underline-offset-2 hover:underline";

/** Shared undo snackbar — reversible recovery, not a primary CTA. */
export function showUndoToast(
  message: string,
  onUndo: () => void | Promise<void>,
  options: { durationMs?: number; undoLabel?: string } = {},
) {
  const { durationMs = 5000, undoLabel = "Undo" } = options;

  toast.custom(
    (id) => (
      <div role="status" aria-live="polite" className={toastSurface}>
        <div className="min-w-0 flex-1 text-[14px] font-medium leading-snug">
          {message}
        </div>
        <button
          type="button"
          aria-label={undoLabel}
          onClick={() => {
            void onUndo();
            toast.dismiss(id);
          }}
          className={undoBtn}
        >
          {undoLabel}
        </button>
      </div>
    ),
    { duration: durationMs },
  );
}

export function showActionToast(
  message: string,
  actionLabel: string,
  onAction: () => void,
  options: { durationMs?: number; actionAriaLabel?: string } = {},
) {
  const { durationMs = 5000, actionAriaLabel } = options;
  toast.custom(
    (id) => (
      <div role="status" aria-live="polite" className={toastSurface}>
        <div className="min-w-0 flex-1 text-[14px] font-medium leading-snug">
          {message}
        </div>
        <button
          type="button"
          aria-label={actionAriaLabel ?? actionLabel}
          onClick={() => {
            onAction();
            toast.dismiss(id);
          }}
          className={undoBtn}
        >
          {actionLabel}
        </button>
      </div>
    ),
    { duration: durationMs },
  );
}

/** Undo + secondary action in one snackbar (e.g. archive with View). */
export function showUndoActionToast(
  message: string,
  onUndo: () => void | Promise<void>,
  actionLabel: string,
  onAction: () => void,
  options: {
    durationMs?: number;
    undoLabel?: string;
    actionAriaLabel?: string;
  } = {},
) {
  const {
    durationMs = 5000,
    undoLabel = "Undo",
    actionAriaLabel,
  } = options;

  toast.custom(
    (id) => (
      <div
        role="status"
        aria-live="polite"
        className={`${toastSurface} gap-2`}
      >
        <div className="min-w-0 flex-1 text-[14px] font-medium leading-snug">
          {message}
        </div>
        <button
          type="button"
          aria-label={actionAriaLabel ?? actionLabel}
          onClick={() => {
            onAction();
            toast.dismiss(id);
          }}
          className={secondaryBtn}
        >
          {actionLabel}
        </button>
        <button
          type="button"
          aria-label={undoLabel}
          onClick={() => {
            void onUndo();
            toast.dismiss(id);
          }}
          className={undoBtn}
        >
          {undoLabel}
        </button>
      </div>
    ),
    { duration: durationMs },
  );
}
