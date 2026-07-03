import { useEffect, useState } from "react";
import type { ArchiveItem } from "@/lib/store";
import { readArchiveVisits } from "@/lib/archiveMeta";
import {
  discoverMemoryLenses,
  type MemoryLens,
} from "@/lib/memoryDiscovery";

export function useMemoryLenses(items: ArchiveItem[]) {
  const [lenses, setLenses] = useState<MemoryLens[]>([]);
  const [ready, setReady] = useState(items.length < 2);

  useEffect(() => {
    if (items.length < 2) {
      setLenses([]);
      setReady(true);
      return;
    }

    setReady(false);
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      const visits = readArchiveVisits();
      setLenses(discoverMemoryLenses(items, visits));
      setReady(true);
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 800 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(run, 48);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [items]);

  return { lenses, ready };
}
