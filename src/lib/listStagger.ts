import { useRef } from "react";

/** First-visit list enter only — revisit skips stagger (motion sickness). */
const seen = new Set<string>();

export type ListStaggerProps = {
  className: string;
  "data-stagger"?: "off";
};

function resolveListStagger(key: string): ListStaggerProps {
  if (seen.has(key)) {
    return { className: "list-stagger", "data-stagger": "off" };
  }
  seen.add(key);
  return { className: "list-stagger" };
}

/** Stable for the component mount — does not flip mid-animation on re-render. */
export function useListStagger(key: string): ListStaggerProps {
  const ref = useRef<ListStaggerProps | null>(null);
  if (ref.current === null) {
    ref.current = resolveListStagger(key);
  }
  return ref.current;
}
