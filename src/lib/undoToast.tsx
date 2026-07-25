import { toast } from "sonner";

const toastBtn =
  "touch-target shrink-0 rounded-full bg-primary px-4 text-xs font-bold text-ink";

/** Shared 5s undo snackbar — reversible actions only. */
export function showUndoToast(
  message: string,
  onUndo: () => void | Promise<void>,
  options: { durationMs?: number; undoLabel?: string } = {},
) {
  const { durationMs = 5000, undoLabel = "Undo" } = options;

  toast.custom(
    (id) => (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-[24px] bg-ink px-4 py-3 text-white shadow-float"
      >
        <div className="min-w-0 flex-1 text-sm">{message}</div>
        <button
          type="button"
          aria-label={undoLabel}
          onClick={() => {
            void onUndo();
            toast.dismiss(id);
          }}
          className={toastBtn}
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
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-[24px] bg-ink px-4 py-3 text-white shadow-float"
      >
        <div className="min-w-0 flex-1 text-sm">{message}</div>
        <button
          type="button"
          aria-label={actionAriaLabel ?? actionLabel}
          onClick={() => {
            onAction();
            toast.dismiss(id);
          }}
          className={toastBtn}
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
        className="flex items-center gap-2 rounded-[24px] bg-ink px-4 py-3 text-white shadow-float"
      >
        <div className="min-w-0 flex-1 text-sm">{message}</div>
        <button
          type="button"
          aria-label={actionAriaLabel ?? actionLabel}
          onClick={() => {
            onAction();
            toast.dismiss(id);
          }}
          className={toastBtn}
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
          className={`${toastBtn} bg-white/15 text-white`}
        >
          {undoLabel}
        </button>
      </div>
    ),
    { duration: durationMs },
  );
}
