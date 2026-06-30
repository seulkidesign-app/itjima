import { useEffect, useRef, useState } from "react";
import type { BrainMirrorResult } from "@/lib/brainMirror";
import { isBrainMirrorCandidate } from "@/lib/brainMirror";
import { fetchBrainMirror } from "@/lib/brainMirrorApi";
import { setInboxBrainMirror, useInbox, type InboxItem } from "@/lib/store";
import { useT } from "@/lib/i18n";

const MAGIC_DELAY_MS = 1200;
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
  onCancel,
}: {
  result: BrainMirrorResult;
  onCancel: () => void;
}) {
  const t = useT();

  return (
    <div className="mt-3 animate-[fade-in-soft_0.45s_ease-out] border-t border-ink/[0.06] pt-3">
      <p className="text-[12px] leading-relaxed text-ink-soft/85">
        {t("🧠 이렇게 이해했어요", "🧠 Here's how I read it")}
      </p>

      <div className="my-2.5 h-px bg-ink/[0.05]" />

      <p className="text-[14px] font-semibold leading-snug text-ink/90">{result.title}</p>

      {result.items.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {result.items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[13px] leading-snug text-ink-soft">
              <span className="mt-[3px] text-[11px] text-ink-soft/50" aria-hidden>
                □
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {result.suggestedAction && (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft/80">{result.suggestedAction}</p>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-[12px] font-medium text-ink-soft/60 transition active:scale-[0.98] hover:text-ink-soft"
        >
          {t("취소", "Cancel")}
        </button>
      </div>
    </div>
  );
}

type InboxHandle = Pick<ReturnType<typeof useInbox>, "update">;

export function BrainMirrorPanel({
  item,
  inbox,
}: {
  item: InboxItem;
  inbox: InboxHandle;
}) {
  const [phase, setPhase] = useState<"idle" | "waiting" | "loading" | "ready" | "hidden">("idle");
  const [result, setResult] = useState<BrainMirrorResult | null>(
    item.brain_mirror ? normalizeStored(item.brain_mirror) : null,
  );
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (dismissed.has(item.id)) {
      setPhase("hidden");
      return;
    }

    if (item.brain_mirror) {
      setResult(normalizeStored(item.brain_mirror));
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
    }, MAGIC_DELAY_MS);

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
      onCancel={() => {
        dismissed.add(item.id);
        setPhase("hidden");
      }}
    />
  );
}

/** Backward-compat for older localStorage shape */
function normalizeStored(raw: BrainMirrorResult): BrainMirrorResult {
  if ("items" in raw && Array.isArray(raw.items)) return raw;
  const legacy = raw as BrainMirrorResult & { tasks?: string[]; message?: string };
  return {
    title: legacy.title,
    items: legacy.items ?? legacy.tasks ?? [],
    suggestedDateText: legacy.suggestedDateText ?? "",
    suggestedAction: legacy.suggestedAction ?? legacy.message ?? "",
    confidence: legacy.confidence ?? 0.75,
  };
}
