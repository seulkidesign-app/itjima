import { useEffect, useRef } from "react";

type Column = {
  label: string;
  values: number[];
  pad?: number;
};

type Props = {
  columns: Column[];
  value: number[];
  onChange: (value: number[]) => void;
};

function formatValue(v: number, pad?: number) {
  return pad ? String(v).padStart(pad, "0") : String(v);
}

export function WheelPicker({ columns, value, onChange }: Props) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    columns.forEach((col, i) => {
      const el = refs.current[i];
      if (!el) return;
      const idx = col.values.indexOf(value[i]);
      if (idx >= 0) {
        const item = el.children[idx] as HTMLElement | undefined;
        item?.scrollIntoView({ block: "center" });
      }
    });
  }, [columns, value]);

  const onScroll = (colIndex: number) => {
    const el = refs.current[colIndex];
    if (!el) return;
    const center = el.scrollTop + el.clientHeight / 2;
    let closest = 0;
    let minDist = Infinity;
    Array.from(el.children).forEach((child, idx) => {
      const node = child as HTMLElement;
      const mid = node.offsetTop + node.offsetHeight / 2;
      const dist = Math.abs(mid - center);
      if (dist < minDist) {
        minDist = dist;
        closest = idx;
      }
    });
    const next = [...value];
    next[colIndex] = columns[colIndex].values[closest];
    if (next[colIndex] !== value[colIndex]) onChange(next);
  };

  return (
    <div className="relative flex gap-1 rounded-2xl bg-ink/[0.03] px-1 py-2">
      <div className="pointer-events-none absolute inset-x-2 top-1/2 z-10 h-10 -translate-y-1/2 rounded-xl border border-ink/10 bg-white/40" />
      {columns.map((col, colIndex) => (
        <div key={col.label} className="flex min-w-0 flex-1 flex-col items-center">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft">{col.label}</div>
          <div
            ref={(el) => {
              refs.current[colIndex] = el;
            }}
            className="wheel-col w-full"
            onScroll={() => onScroll(colIndex)}
          >
            <div className="h-[90px]" aria-hidden />
            {col.values.map((v) => (
              <div
                key={v}
                className="flex h-10 snap-center items-center justify-center text-[18px] font-semibold text-ink"
              >
                {formatValue(v, col.pad)}
              </div>
            ))}
            <div className="h-[90px]" aria-hidden />
          </div>
        </div>
      ))}
    </div>
  );
}
