import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { BrainMirrorResult } from "@/lib/brainMirror";
import { isBrainMirrorCandidate } from "@/lib/brainMirror";
import { fetchBrainMirror } from "@/lib/brainMirrorApi";
import { setInboxBrainMirror, useInbox, type InboxItem } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { SPRING_DEFAULT } from "@/lib/motion";

const MAGIC_DELAY_MS = 200;
const THINKING_MAX_MS = 1000;

const SK = {
  attempted: (id: string) => `itjima.bm.attempted.${id}`,
  dismissed: (id: string) => `itjima.bm.dismissed.${id}`,
  schedule: (id: string) => `itjima.bm.schedule.${id}`,
};

function ThinkingIndicator({ inline }: { inline?: boolean }) {
  return (
    <div
      className={`mt-1.5 ${inline ? "system-reply" : "rounded-[24px] bg-[#111111] px-[22px] py-4"}`}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-1.5 px-0.5 py-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`imessage-dot ${inline ? "bg-ink/30" : "bg-white/40"}`}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function BrainMirrorResultView({
  result,
  completedItems,
  onToggleItem,
  onCancel,
  inline,
}: {
  result: BrainMirrorResult;
  completedItems: Set<string>;
  onToggleItem: (line: string) => void;
  onCancel: () => void;
  inline?: boolean;
}) {
  const t = useT();

  if (inline) {
    return (
      <motion.div
        className="system-reply mt-1.5"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING_DEFAULT, duration: 0.15 }}
      >
        <p className="text-[11px] font-medium text-ink-soft">
          {t("🧠 이렇게 이해했어요", "🧠 Here's how I read it")}
        </p>
        <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">
          {result.title}
        </p>
        {result.items.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {result.items.slice(0, 4).map((line) => {
              const done = completedItems.has(line);
              return (
                <li
                  key={line}
                  className={`text-[12px] leading-relaxed ${done ? "text-ink-soft line-through" : "text-ink/80"}`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleItem(line)}
                    className="text-left"
                  >
                    {done ? "☑" : "·"} {line}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 text-[11px] font-medium text-ink-soft underline-offset-2 hover:underline"
        >
          {t("되돌리기", "Undo")}
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="mt-3 rounded-[24px] bg-[#111111] px-[22px] py-5 text-white shadow-card"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...SPRING_DEFAULT, duration: 0.15 }}
    >
      <p className="text-[13px] font-medium leading-relaxed text-white/60">
        {t("🧠 이렇게 이해했어요", "🧠 Here's how I read it")}
      </p>

      <div className="my-3 h-px bg-white/10" />

      <p className="text-[16px] font-semibold leading-[1.7] text-white">
        {result.title}
      </p>

      {result.items.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {result.items.map((line) => {
            const done = completedItems.has(line);
            return (
              <li key={line}>
                <button
                  type="button"
                  onClick={() => onToggleItem(line)}
                  className={`flex w-full items-start gap-2.5 text-left text-[15px] leading-[1.8] transition ${
                    done ? "text-white/40 line-through" : "text-white/85"
                  }`}
                >
                  <span className="mt-[5px] text-[11px]" aria-hidden>
                    {done ? "☑" : "□"}
                  </span>
                  <span>{line}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {result.suggestedAction && (
        <p className="mt-4 text-[14px] leading-[1.7] text-white/65">
          {result.suggestedAction}
        </p>
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
    </motion.div>
  );
}

type InboxHandle = Pick<ReturnType<typeof useInbox>, "update">;

export function BrainMirrorPanel({
  item,
  inbox,
  eligible,
  onAutoAct,
  onCancelAct,
  onMirrorMissed,
  variant = "inline",
}: {
  item: InboxItem;
  inbox: InboxHandle;
  eligible: boolean;
  onAutoAct: (
    item: InboxItem,
    result: BrainMirrorResult,
  ) => Promise<string | null>;
  onCancelAct: (scheduleId: string) => Promise<void>;
  onMirrorMissed?: (item: InboxItem) => void;
  variant?: "inline" | "card";
}) {
  const [phase, setPhase] = useState<"idle" | "thinking" | "ready" | "hidden">(
    "idle",
  );
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
      const stored = normalizeStored(item.brain_mirror);
      if (!stored.items.length) {
        setPhase("hidden");
        return;
      }
      setResult(stored);
      setPhase("ready");
      return;
    }

    if (!eligible) return;

    if (!isBrainMirrorCandidate(item.text)) return;
    if (sessionStorage.getItem(SK.attempted(item.id))) return;

    sessionStorage.setItem(SK.attempted(item.id), "1");
    setPhase("thinking");

    const abortController = new AbortController();
    const timeouts: number[] = [];
    let finished = false;

    const cleanup = () => {
      finished = true;
      abortController.abort();
      for (const id of timeouts) window.clearTimeout(id);
    };

    const hideSilently = (offerDateFallback = false) => {
      if (finished) return;
      cleanup();
      setPhase("hidden");
      if (offerDateFallback) onMirrorMissed?.(item);
    };

    const showResult = (mirror: BrainMirrorResult) => {
      if (finished) return;
      if (!mirror.items.length) {
        hideSilently(true);
        return;
      }
      cleanup();
      setResult(mirror);
      setPhase("ready");
      void setInboxBrainMirror(inbox, item.id, mirror);
    };

    timeouts.push(
      window.setTimeout(() => {
        hideSilently(true);
      }, THINKING_MAX_MS),
    );

    timeouts.push(
      window.setTimeout(() => {
        void (async () => {
          if (finished) return;
          try {
            const mirror = await fetchBrainMirror(
              item.text,
              abortController.signal,
            );
            if (finished) return;
            if (!mirror) {
              hideSilently(true);
              return;
            }
            showResult(mirror);
          } catch {
            if (!finished) hideSilently(true);
          }
        })();
      }, MAGIC_DELAY_MS),
    );

    return cleanup;
  }, [item.id, item.text, item.brain_mirror, eligible, inbox, onMirrorMissed]);

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
  if (phase === "thinking")
    return <ThinkingIndicator inline={variant === "inline"} />;
  if (!result?.items.length) return null;

  const completedItems = new Set(result.completedItems ?? []);

  const toggleItem = (line: string) => {
    const nextCompleted = new Set(completedItems);
    if (nextCompleted.has(line)) nextCompleted.delete(line);
    else nextCompleted.add(line);
    const next = { ...result, completedItems: [...nextCompleted] };
    setResult(next);
    void setInboxBrainMirror(inbox, item.id, next);
    haptic(4);
  };

  return (
    <BrainMirrorResultView
      result={result}
      completedItems={completedItems}
      onToggleItem={toggleItem}
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
      inline={variant === "inline"}
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
      completedItems: raw.completedItems ?? [],
    };
  }
  const legacy = raw as BrainMirrorResult & {
    tasks?: string[];
    message?: string;
  };
  return {
    title: legacy.title,
    items: legacy.items ?? legacy.tasks ?? [],
    suggestedDateText: legacy.suggestedDateText ?? "",
    suggestedAction: legacy.suggestedAction ?? legacy.message ?? "",
    confidence: legacy.confidence ?? 0.75,
    version: legacy.version ?? 1,
    isCurrent: legacy.isCurrent !== false,
    completedItems: legacy.completedItems ?? [],
  };
}
