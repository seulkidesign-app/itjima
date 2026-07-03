import { useEffect, useRef, useState } from "react";
import type { ArchiveItem } from "@/lib/store";
import { readArchiveVisits } from "@/lib/archiveMeta";
import {
  discoverMemoryLenses,
  type MemoryLens,
} from "@/lib/memoryDiscovery";

const STAGGER_MS = 100;

export function useMemoryLenses(items: ArchiveItem[]) {
  const [lenses, setLenses] = useState<MemoryLens[]>([]);
  const [ready, setReady] = useState(items.length < 2);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (items.length < 2) {
      setLenses([]);
      setReady(true);
      return;
    }

    setLenses([]);
    setReady(false);
    let cancelled = false;

    const reveal = (found: MemoryLens[]) => {
      if (cancelled) return;
      setReady(true);
      if (!found.length) {
        setLenses([]);
        return;
      }
      found.forEach((lens, i) => {
        const id = window.setTimeout(() => {
          if (cancelled) return;
          setLenses((prev) => [...prev, lens]);
        }, i * STAGGER_MS);
        timers.current.push(id);
      });
    };

    const run = () => {
      if (cancelled) return;
      reveal(discoverMemoryLenses(items, readArchiveVisits()));
    };

    if (typeof requestIdleCallback !== "undefined") {
      const idleId = requestIdleCallback(run, { timeout: 900 });
      return () => {
        cancelled = true;
        cancelIdleCallback(idleId);
        timers.current.forEach(clearTimeout);
      };
    }

    const id = window.setTimeout(run, 32);
    return () => {
      cancelled = true;
      clearTimeout(id);
      timers.current.forEach(clearTimeout);
    };
  }, [items]);

  return { lenses, ready };
}
