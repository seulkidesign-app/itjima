import { useEffect, useMemo, useRef, useState } from "react";
import { useInbox, useArchive } from "@/lib/store";
import { readArchivePins } from "@/lib/archiveMeta";
import {
  buildMemoryJourney,
  type JourneyChapter,
} from "@/lib/memoryJourney";
import type { ThoughtLike } from "@/lib/thinkingInsights";

function mergeThoughts(
  inbox: ThoughtLike[],
  archive: ThoughtLike[],
): ThoughtLike[] {
  const seen = new Set<string>();
  const out: ThoughtLike[] = [];
  for (const it of [...inbox, ...archive]) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

const STAGGER_MS = 90;

export function useMemoryJourney(pins?: Set<string>) {
  const inbox = useInbox();
  const archive = useArchive();
  const [chapters, setChapters] = useState<JourneyChapter[]>([]);
  const [ready, setReady] = useState(false);
  const timers = useRef<number[]>([]);

  const thoughts = useMemo(
    () => mergeThoughts(inbox.items, archive.items),
    [inbox.items, archive.items],
  );

  const pinSet = pins ?? readArchivePins();

  const allChapters = useMemo(
    () => buildMemoryJourney(thoughts, pinSet),
    [thoughts, pinSet],
  );

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setChapters([]);
    setReady(false);

    if (!allChapters.length) {
      setReady(true);
      return;
    }

    let cancelled = false;

    const reveal = () => {
      if (cancelled) return;
      setReady(true);
      allChapters.forEach((ch, i) => {
        const id = window.setTimeout(() => {
          if (cancelled) return;
          setChapters((prev) => [...prev, ch]);
        }, i * STAGGER_MS);
        timers.current.push(id);
      });
    };

    if (typeof requestIdleCallback !== "undefined") {
      const idleId = requestIdleCallback(reveal, { timeout: 800 });
      return () => {
        cancelled = true;
        cancelIdleCallback(idleId);
        timers.current.forEach(clearTimeout);
      };
    }

    const id = window.setTimeout(reveal, 40);
    return () => {
      cancelled = true;
      clearTimeout(id);
      timers.current.forEach(clearTimeout);
    };
  }, [allChapters]);

  return { chapters, thoughts, ready };
}
