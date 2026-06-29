import { useEffect, useRef, useState } from "react";
import type { BrainMirrorResult } from "@/lib/brainMirror";
import { isBrainMirrorCandidate } from "@/lib/brainMirror";
import { fetchBrainMirror } from "@/lib/brainMirrorApi";
import { setInboxBrainMirror, useInbox, type InboxItem } from "@/lib/store";
import { useT } from "@/lib/i18n";

const attempted = new Set<string>();
const dismissed = new Set<string>();

function BrainMirrorDots() {
  return (
    <div className="mt-3 flex items-center gap-1.5 pt-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-ink-soft/35 animate-bounce"
          style={{ animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }}
        />
      ))}
    </div>
  );
}

function BrainMirrorResultView({
  result,
  onSchedule,
  onDismiss,
}: {
  result: BrainMirrorResult;
  onSchedule: () => void;
  onDismiss: () => void;
}) {
  const t = useT();

  return (
    <div className="mt-3 animate-fade-in border-t border-ink/[0.06] pt-3">
      <p className="text-[12px] leading-relaxed text-ink-soft/85">
        {t("🧠 이렇게 이해했어요.", "🧠 Here's how I read it.")}
      </p>

      <div className="my-2.5 h-px bg-ink/[0.05]" />

      <p className="text-[14px] font-semibold leading-snug text-ink/90">{result.title}</p>

      {result.tasks.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {result.tasks.map((task) => (
            <li key={task} className="flex items-start gap-2 text-[13px] leading-snug text-ink-soft">
              <span className="mt-[3px] text-[11px] text-ink-soft/50" aria-hidden>
                □
              </span>
              <span>{task}</span>
            </li>
          ))}
        </ul>
      )}

      {result.message && (
        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-soft/75">{result.message}</p>
      )}

      <div className="my-3 h-px bg-ink/[0.05]" />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSchedule}
          className="rounded-full border border-ink/10 bg-white/70 px-3.5 py-1.5 text-[12px] font-medium text-ink/80 transition active:scale-[0.98]"
        >
          {t("일정으로 만들기", "Add to schedule")}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-3.5 py-1.5 text-[12px] font-medium text-ink-soft/70 transition active:scale-[0.98]"
        >
          {t("그냥 둘게요", "Leave it for now")}
        </button>
      </div>
    </div>
  );
}

type InboxHandle = Pick<ReturnType<typeof useInbox>, "update">;

export function BrainMirrorPanel({
  item,
  inbox,
  onSchedule,
}: {
  item: InboxItem;
  inbox: InboxHandle;
  onSchedule: (item: InboxItem, result: BrainMirrorResult) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "waiting" | "loading" | "ready" | "hidden">("idle");
  const [result, setResult] = useState<BrainMirrorResult | null>(item.brain_mirror ?? null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (dismissed.has(item.id)) {
      setPhase("hidden");
      return;
    }

    if (item.brain_mirror) {
      setResult(item.brain_mirror);
      setPhase("ready");
      return;
    }

    if (!isBrainMirrorCandidate(item.text)) return;
    if (attempted.has(item.id)) return;

    setPhase("waiting");

    timerRef.current = window.setTimeout(async () => {
      attempted.add(item.id);
      setPhase("loading");

      const mirror = await fetchBrainMirror(item.text);
      if (!mirror) {
        setPhase("hidden");
        return;
      }

      setResult(mirror);
      setPhase("ready");
      await setInboxBrainMirror(inbox, item.id, mirror);
    }, 1500);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [item.id, item.text, item.brain_mirror, inbox]);

  if (phase === "idle" || phase === "hidden") return null;
  if (phase === "waiting" || phase === "loading") return <BrainMirrorDots />;

  if (!result) return null;

  return (
    <BrainMirrorResultView
      result={result}
      onSchedule={() => onSchedule(item, result)}
      onDismiss={() => {
        dismissed.add(item.id);
        setPhase("hidden");
      }}
    />
  );
}

/** @deprecated Use BrainMirrorPanel */
export function BrainMirrorSummary({ result }: { result: BrainMirrorResult }) {
  return (
    <BrainMirrorResultView
      result={result}
      onSchedule={() => {}}
      onDismiss={() => {}}
    />
  );
}

/** @deprecated Use BrainMirrorPanel */
export function BrainMirrorPlaceholder() {
  return null;
}
