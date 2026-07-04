import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { BrainMirrorResult } from "@/lib/brainMirror";
import { isBrainMirrorCandidate } from "@/lib/brainMirror";
import { fetchBrainMirror } from "@/lib/brainMirrorApi";
import { setInboxBrainMirror, useInbox, type InboxItem } from "@/lib/store";
import { detectDate } from "@/lib/dateDetect";
import { useT } from "@/lib/i18n";
import { haptic, tap } from "@/lib/haptics";
import {
  BrainMirrorReflectionActions,
  BrainMirrorReflectionBody,
  BrainMirrorReflectionShell,
  BrainMirrorRestoreLink,
} from "@/components/BrainMirrorReflection";

const APPEAR_DELAY_MS = 1100;
const MIN_CONFIDENCE = 0.62;
const FETCH_TIMEOUT_MS = 14_000;

const SK = {
  attempted: (id: string) => `itjima.bm.attempted.${id}`,
  dismissed: (id: string) => `itjima.bm.dismissed.${id}`,
  schedule: (id: string) => `itjima.bm.schedule.${id}`,
};

type InboxHandle = Pick<ReturnType<typeof useInbox>, "update">;

export function BrainMirrorPanel({
  item,
  inbox,
  eligible,
  onAutoAct,
  onCancelAct: _onCancelAct,
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
  const t = useT();
  const compact = variant === "inline";

  const [phase, setPhase] = useState<"idle" | "pending" | "ready" | "hidden">(
    () => {
      if (sessionStorage.getItem(SK.dismissed(item.id))) return "hidden";
      if (
        item.brain_mirror &&
        normalizeStored(item.brain_mirror).items.length
      ) {
        return "ready";
      }
      return "idle";
    },
  );
  const [visible, setVisible] = useState(() => {
    if (sessionStorage.getItem(SK.dismissed(item.id))) return false;
    return Boolean(
      item.brain_mirror && normalizeStored(item.brain_mirror).items.length,
    );
  });
  const [result, setResult] = useState<BrainMirrorResult | null>(() =>
    item.brain_mirror ? normalizeStored(item.brain_mirror) : null,
  );
  const [acting, setActing] = useState(false);
  const fetchGen = useRef(0);
  const createdAt = useRef(+new Date(item.created_at));

  const dismiss = useCallback(() => {
    sessionStorage.setItem(SK.dismissed(item.id), "1");
    setVisible(false);
    window.setTimeout(() => setPhase("hidden"), 180);
  }, [item.id]);

  const restore = useCallback(() => {
    sessionStorage.removeItem(SK.dismissed(item.id));
    setPhase("ready");
    setVisible(true);
    tap();
  }, [item.id]);

  const runAnalysis = useCallback(() => {
    if (!item.text.trim()) return;
    const gen = ++fetchGen.current;
    sessionStorage.setItem(SK.attempted(item.id), "1");
    setPhase("pending");

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(
      () => abortController.abort(),
      FETCH_TIMEOUT_MS,
    );
    let finished = false;

    const cleanup = () => {
      finished = true;
      abortController.abort();
      window.clearTimeout(timeoutId);
    };

    const hideSilently = (offerDateFallback = false, apiUnavailable = false) => {
      if (finished || fetchGen.current !== gen) return;
      cleanup();
      setPhase("hidden");
      if (offerDateFallback) {
        const hadDate = Boolean(detectDate(item.text));
        onMirrorMissed?.(item);
        if (apiUnavailable && !hadDate) {
          toast.message(
            t(
              "지금은 정리 제안을 불러오지 못했어요",
              "Couldn't load a reflection right now",
            ),
            { duration: 2800 },
          );
        }
      }
    };

    const reveal = (mirror: BrainMirrorResult) => {
      if (finished || fetchGen.current !== gen) return;
      cleanup();
      setResult(mirror);
      setPhase("ready");
      const elapsed = Date.now() - createdAt.current;
      const wait = Math.max(0, APPEAR_DELAY_MS - elapsed);
      window.setTimeout(() => {
        if (fetchGen.current !== gen) return;
        setVisible(true);
        haptic([3, 8, 4]);
      }, wait);
      void setInboxBrainMirror(inbox, item.id, mirror);
    };

    void (async () => {
      try {
        const outcome = await fetchBrainMirror(
          item.text,
          abortController.signal,
        );
        if (finished || fetchGen.current !== gen) return;
        if (outcome.status === "unavailable") {
          hideSilently(true, true);
          return;
        }
        if (outcome.status !== "ok") {
          hideSilently(true);
          return;
        }
        const mirror = outcome.result;
        if (!mirror.items.length || mirror.confidence < MIN_CONFIDENCE) {
          hideSilently(true);
          return;
        }
        reveal(mirror);
      } catch {
        if (!finished && fetchGen.current === gen) hideSilently(true, true);
      }
    })();

    return cleanup;
  }, [inbox, item, onMirrorMissed, t]);

  useEffect(() => {
    createdAt.current = +new Date(item.created_at);
  }, [item.id, item.created_at]);

  useEffect(() => {
    if (sessionStorage.getItem(SK.dismissed(item.id))) {
      setPhase("hidden");
      setVisible(false);
      return;
    }

    if (item.brain_mirror) {
      const stored = normalizeStored(item.brain_mirror);
      if (!stored.items.length || stored.confidence < MIN_CONFIDENCE) {
        setPhase("hidden");
        setVisible(false);
        return;
      }
      setResult(stored);
      setPhase("ready");
      setVisible(true);
      return;
    }

    if (!eligible) return;
    if (!isBrainMirrorCandidate(item.text)) return;
    if (sessionStorage.getItem(SK.attempted(item.id))) return;

    return runAnalysis();
  }, [item.id, item.text, item.brain_mirror, eligible, runAnalysis]);

  const acceptDate = async () => {
    if (!result || acting) return;
    if (sessionStorage.getItem(SK.schedule(item.id))) return;
    setActing(true);
    try {
      const scheduleId = await onAutoAct(item, result);
      if (scheduleId) {
        sessionStorage.setItem(SK.schedule(item.id), scheduleId);
        haptic([4, 10, 6]);
        dismiss();
      }
    } finally {
      setActing(false);
    }
  };

  if (phase === "hidden" && result?.items.length) {
    return <BrainMirrorRestoreLink onRestore={restore} />;
  }

  if (phase !== "ready" || !result?.items.length) return null;

  const alreadyScheduled = Boolean(sessionStorage.getItem(SK.schedule(item.id)));
  const showDateOffer =
    shouldOfferDate(result) && !alreadyScheduled;

  return (
    <BrainMirrorReflectionShell visible={visible} compact={compact}>
      <BrainMirrorReflectionBody
        result={result}
        compact={compact}
        showDateHint={showDateOffer}
        dateLabel={result.suggestedDateText?.trim() || null}
      />
      <BrainMirrorReflectionActions
        compact={compact}
        showDateOffer={showDateOffer}
        acting={acting}
        onAcceptDate={() => {
          tap();
          void acceptDate();
        }}
        onKeepHere={dismiss}
        onDismiss={() => {
          tap();
          dismiss();
        }}
      />
    </BrainMirrorReflectionShell>
  );
}

function shouldOfferDate(result: BrainMirrorResult): boolean {
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
