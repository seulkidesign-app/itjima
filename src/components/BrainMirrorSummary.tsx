import type { BrainMirrorResult } from "@/lib/brainMirror";
import { useT } from "@/lib/i18n";

export function BrainMirrorSummary({ result }: { result: BrainMirrorResult }) {
  const t = useT();
  return (
    <div className="mt-3 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">
        {t("Brain Mirror", "Brain Mirror")}
      </div>
      <div className="mt-1 text-[15px] font-bold leading-snug text-ink">{result.title}</div>
      {result.tasks.length > 0 && (
        <ul className="mt-2 space-y-1">
          {result.tasks.map((task) => (
            <li key={task} className="flex items-start gap-2 text-[13px] text-ink-soft">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
              <span>{task}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{result.message}</p>
    </div>
  );
}

/** Reserved area for cards that will receive Brain Mirror results later */
export function BrainMirrorPlaceholder() {
  const t = useT();
  return (
    <div
      className="mt-3 rounded-xl border border-dashed border-ink/10 bg-ink/[0.02] px-3.5 py-2.5"
      aria-hidden
    >
      <p className="text-[11px] leading-relaxed text-ink-soft/70">
        {t(
          "긴 생각은 Brain Mirror로 묶어 드릴 수 있어요.",
          "Long thoughts can be grouped with Brain Mirror.",
        )}
      </p>
    </div>
  );
}
