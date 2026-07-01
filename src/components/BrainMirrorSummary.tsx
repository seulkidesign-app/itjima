import { useEffect, useRef, useState } from "react";
import type { BrainMirrorResult } from "@/lib/brainMirror";
import { isBrainMirrorCandidate } from "@/lib/brainMirror";
import { fetchBrainMirror } from "@/lib/brainMirrorApi";
import { setInboxBrainMirror, useInbox, type InboxItem } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";

const MAGIC_DELAY_MS = 300;
const THINKING_TIER_1_MS = 300;
const THINKING_TIER_2_MS = 3000;
const THINKING_TIER_3_MS = 8000;

const SK = {
  attempted: (id: string) => `itjima.bm.attempted.${id}`,
  dismissed: (id: string) => `itjima.bm.dismissed.${id}`,
  schedule: (id: string) => `itjima.bm.schedule.${id}`,
};

type ThinkingTier = 0 | 1 | 2 | 3;

function ThinkingIndicator({ tier }: { tier: ThinkingTier }) {
  const t = useT();
  if (tier === 0) return null;

  const copy =
    tier === 1
      ? t("잠깐만요", "One moment")
      : tier === 2
        ? t("천천히 읽고 있어요", "Reading it slowly")
        : t("조금 더 걸리네요", "Taking a bit longer");

  return (
    <div
      className="mt-3 animate-bm-enter rounded-[24px] bg-ink px-[22px] py-4"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-white/35 animate-bounce"
              style={{ animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }}
            />
          ))}
        </div>
        <p className="text-[13px] leading-relaxed text-white/70">{copy}</p>
      </div>
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
    <div className="mt-3 animate-bm-enter rounded-[24px] bg-ink px-[22px] py-5 text-white shadow-card">
      <p className="text-[13px] font-medium leading-relaxed text-white/60">
        {t("🧠 이렇게 이해했어요", "🧠 Here's how I read it")}
      </p>

      <div className="my-3 h-px bg-white/10" />

      <p className="text-[16px] font-semibold leading-[1.7] text-white">{result.title}</p>

      {result.items.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {result.items.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[15px] leading-[1.8] text-white/85">
              <span className="mt-[5px] text-[11px] text-white/40" aria-hidden>
                □
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      {result.suggestedAction && (
        <p className="mt-4 text-[14px] leading-[1.7] text-white/65">{result.suggestedAction}</p>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white/50 transition active:scale-[0.98] hover:text-white/75"
        >
          {t("되돌리기", "Undo")}
        </button>
      </div>
    </div>
  );
}

type InboxHandle = Pick<ReturnType<typeof useInbox>, "update">;

export function BrainMirrorPanel({
  item,
  inbox,
  onAutoAct,
  onCancelAct,
}: {
  item: InboxItem;
  inbox: InboxHandle;
  onAutoAct: (item: InboxItem, result: BrainMirrorResult) => Promise<string | null>;
  onCancelAct: (scheduleId: string) => Promise<void>;
}) {
  const [phase, setPhase] = useState<"idle" | "thinking" | "ready" | "hidden">("idle");
  const [thinkingTier, setThinkingTier] = useState<ThinkingTier>(0);
  const [result, setResult] = useState<BrainMirrorResult | null>(
    item.brain_mirror ? normalizeStored(item.brain_mirror) : null,
  );
  const autoActStarted = useRef(false);

  useEffect(() => {
    if (sessionStorage.getItem(SK.dismissed(item.id))) {
      setPhase("hidden");
      return;
    }

    if (item.brain_mirror) {
      setResult(normalizeStored(item.brain_mirror));
      setPhase("ready");
      return;
    }

    if (!isBrainMirrorCandidate(item.text)) return;
    if (sessionStorage.getItem(SK.attempted(item.id))) return;

    setPhase("thinking");
    setThinkingTier(0);

    const abortController = new AbortController();
    const timeouts: number[] = [];
    let finished = false;

    const cleanup = () => {
      finished = true;
      abortController.abort();
      for (const id of timeouts) window.clearTimeout(id);
    };

    const hideSilently = () => {
      if (finished) return;
      cleanup();
      setPhase("hidden");
      setThinkingTier(0);
    };

    const showResult = (mirror: BrainMirrorResult) => {
      if (finished) return;
      sessionStorage.setItem(SK.attempted(item.id), "1");
      cleanup();
      setResult(mirror);
      setPhase("ready");
      setThinkingTier(0);
      void setInboxBrainMirror(inbox, item.id, mirror);
    };

    timeouts.push(window.setTimeout(() => setThinkingTier(1), THINKING_TIER_1_MS));
    timeouts.push(window.setTimeout(() => setThinkingTier(2), THINKING_TIER_2_MS));
    timeouts.push(
      window.setTimeout(() => {
        setThinkingTier(3);
        hideSilently();
      }, THINKING_TIER_3_MS),
    );

    timeouts.push(
      window.setTimeout(() => {
        void (async () => {
          if (finished) return;
          try {
            const mirror = await fetchBrainMirror(item.text, abortController.signal);
            if (finished) return;
            if (!mirror) {
              hideSilently();
              return;
            }
            showResult(mirror);
          } catch {
            if (!finished) hideSilently();
          }
        })();
      }, MAGIC_DELAY_MS),
    );

    return cleanup;
  }, [item.id, item.text, item.brain_mirror, inbox]);

  useEffect(() => {
    if (phase !== "ready" || !result || autoActStarted.current) return;
    if (sessionStorage.getItem(SK.schedule(item.id))) return;
    if (!shouldAutoAct(result)) return;

    autoActStarted.current = true;
    void (async () => {
      const scheduleId = await onAutoAct(item, result);
      if (scheduleId) {
        sessionStorage.setItem(SK.schedule(item.id), scheduleId);
        haptic([4, 10, 6]);
      }
    })();
  }, [phase, result, item, onAutoAct]);

  if (phase === "idle" || phase === "hidden") return null;
  if (phase === "thinking") return <ThinkingIndicator tier={thinkingTier} />;
  if (!result) return null;

  return (
    <BrainMirrorResultView
      result={result}
      onCancel={() => {
        sessionStorage.setItem(SK.dismissed(item.id), "1");
        const scheduleId = sessionStorage.getItem(SK.schedule(item.id));
        if (scheduleId) {
          void onCancelAct(scheduleId).then(() => {
            sessionStorage.removeItem(SK.schedule(item.id));
          });
        }
        setPhase("hidden");
      }}
    />
  );
}

function shouldAutoAct(result: BrainMirrorResult): boolean {
  return Boolean(result.suggestedDateText?.trim());
}

function normalizeStored(raw: BrainMirrorResult): BrainMirrorResult {
  if ("items" in raw && Array.isArray(raw.items)) {
    return {
      ...raw,
      version: raw.version ?? 1,
      isCurrent: raw.isCurrent !== false,
    };
  }
  const legacy = raw as BrainMirrorResult & { tasks?: string[]; message?: string };
  return {
    title: legacy.title,
    items: legacy.items ?? legacy.tasks ?? [],
    suggestedDateText: legacy.suggestedDateText ?? "",
    suggestedAction: legacy.suggestedAction ?? legacy.message ?? "",
    confidence: legacy.confidence ?? 0.75,
    version: legacy.version ?? 1,
    isCurrent: legacy.isCurrent !== false,
  };
}
