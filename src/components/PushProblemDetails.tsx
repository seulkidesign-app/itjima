import type { PushEnableStep } from "@/lib/push/directPushEnableFlow";

type Props = {
  steps: PushEnableStep[];
  open: boolean;
  onToggle: () => void;
  labels: {
    toggle: string;
  };
};

export function PushProblemDetails({ steps, open, onToggle, labels }: Props) {
  if (steps.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        data-testid="push-problem-details-button"
        onClick={onToggle}
        className="touch-press w-full rounded-[20px] bg-ink/[0.06] px-4 py-3 text-[14px] font-semibold text-ink"
      >
        {labels.toggle}
      </button>
      {open && (
        <ol
          className="mt-2 space-y-1.5 text-[12px] text-ink-soft"
          data-testid="push-enable-steps"
        >
          {steps.map((entry) => (
            <li
              key={entry.id}
              className={entry.ok ? "text-ink-soft" : "text-red-600"}
            >
              {entry.ok ? "✓" : "✗"} {entry.label}: {entry.detail}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
