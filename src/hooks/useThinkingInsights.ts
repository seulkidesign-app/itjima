import { useEffect, useMemo, useState } from "react";
import { useInbox, useArchive } from "@/lib/store";
import {
  discoverThinkingInsights,
  type ThinkingInsight,
  type ThoughtLike,
} from "@/lib/thinkingInsights";

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
  return out.sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

/** Progressive reveal so insights feel discovered, not loaded. */
export function useThinkingInsights() {
  const inbox = useInbox();
  const archive = useArchive();
  const [visibleCount, setVisibleCount] = useState(0);

  const thoughts = useMemo(
    () => mergeThoughts(inbox.items, archive.items),
    [inbox.items, archive.items],
  );

  const insights = useMemo(
    () => discoverThinkingInsights(thoughts),
    [thoughts],
  );

  useEffect(() => {
    setVisibleCount(0);
    if (!insights.length) return;

    let i = 0;
    const tick = () => {
      i += 1;
      setVisibleCount(i);
      if (i < insights.length) {
        id = window.setTimeout(tick, 120);
      }
    };
    let id = window.setTimeout(tick, 200);

    return () => clearTimeout(id);
  }, [insights]);

  const visible: ThinkingInsight[] = insights.slice(0, visibleCount);

  return { insights: visible, ready: visibleCount >= insights.length };
}
