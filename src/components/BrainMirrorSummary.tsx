import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { BrainMirrorResult } from "@/lib/brainMirror";
import { isBrainMirrorCandidate } from "@/lib/brainMirror";
import { fetchBrainMirror } from "@/lib/brainMirrorApi";
import { setInboxBrainMirror, useInbox, type InboxItem } from "@/lib/store";
import { haptic } from "@/lib/haptics";
import { SPRING_DEFAULT } from "@/lib/motion";

const APPEAR_DELAY_MS = 1500;

const SK = {
  attempted: (id: string) => `itjima.bm.attempted.${id}`,
  dismissed: (id: string) => `itjima.bm.dismissed.${id}`,
  schedule: (id: string) => `itjima.bm.schedule.${id}`,
};

function BrainMirrorQuietView({
  result,
  inline,
}: {
  result: BrainMirrorResult;
  inline?: boolean;
}) {
  const interpretive =
    result.suggestedAction?.trim() ||
    (result.items.length === 1 ? `${result.items[0]} 같아요.` : null);

  if (inline) {
    return (
      <motion.div
        className="mt-2 border-t border-dashed border-ink/15 pt-2"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_DEFAULT, duration: 0.2 }}
      >
        <p className="text-[13px] font-semibold leading-snug text-ink/85">
          {result.title}
        </p>
        {result.items.length > 1 && (
          <ul className="mt-1 space-y-0.5">
            {result.items.slice(0, 4).map((line) => (
              <li key={line} className="text-[12px] leading-relaxed text-ink/70">
                · {line}
              </li>
            ))}
          </ul>
        )}
        {interpretive && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
            {interpretive}
          </p>
        )}
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
      <div className="border-b border-dashed border-white/15 pb-3" />
      <p className="mt-3 text-[16px] font-semibold leading-[1.7] text-white">
        {result.title}
      </p>
      {result.items.length > 1 && (
        <ul className="mt-3 space-y-2">
          {result.items.map((line) => (
            <li key={line} className="text-[15px] leading-[1.8] text-white/85">
              {line}
            </li>
          ))}
        </ul>
      )}
      {interpretive && (
        <p className="mt-4 text-[14px] leading-[1.7] text-white/65">
          {interpretive}
        </p>
      )}
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
  const [phase, setPhase] = useState<"idle" | "ready" | "hidden">(() => {
    if (sessionStorage.getItem(SK.dismissed(item.id))) return "hidden";
    if (item.brain_mirror && normalizeStored(item.brain_mirror).items.length) {
      return "ready";
    }
    return "idle";
  });
  const [result, setResult] = useState<BrainMirrorResult | null>(() =>
    item.brain_mirror ? normalizeStored(item.brain_mirror) : null,
  );
  const autoActStarted = useRef(false);
  const fetchGen = useRef(0);

  const runAnalysis = useCallback(() => {
    if (!item.text.trim()) return;
    const gen = ++fetchGen.current;
    sessionStorage.setItem(SK.attempted(item.id), "1");

    const abortController = new AbortController();
    let finished = false;
    let delayTimer: number | undefined;

    const cleanup = () => {
      finished = true;
      abortController.abort();
      if (delayTimer) window.clearTimeout(delayTimer);
    };

    const hideSilently = (offerDateFallback = false) => {
      if (finished || fetchGen.current !== gen) return;
      cleanup();
      setPhase("hidden");
      if (offerDateFallback) onMirrorMissed?.(item);
    };

    const showResult = (mirror: BrainMirrorResult) => {
      if (finished || fetchGen.current !== gen) return;
      if (!mirror.items.length) {
        hideSilently(true);
        return;
      }
      cleanup();
      setResult(mirror);
      setPhase("ready");
      void setInboxBrainMirror(inbox, item.id, mirror);
      haptic([4, 10, 6]);
    };

    delayTimer = window.setTimeout(() => {
      void (async () => {
        if (finished || fetchGen.current !== gen) return;
        try {
          const mirror = await fetchBrainMirror(
            item.text,
            abortController.signal,
          );
          if (finished || fetchGen.current !== gen) return;
          if (!mirror) {
            hideSilently(true);
            return;
          }
          showResult(mirror);
        } catch {
          if (!finished && fetchGen.current === gen) hideSilently(true);
        }
      })();
    }, APPEAR_DELAY_MS);

    return cleanup;
  }, [inbox, item, onMirrorMissed]);

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

    return runAnalysis();
  }, [item.id, item.text, item.brain_mirror, eligible, runAnalysis]);

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

  if (phase !== "ready" || !result?.items.length) return null;

  return (
    <BrainMirrorQuietView result={result} inline={variant === "inline"} />
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
