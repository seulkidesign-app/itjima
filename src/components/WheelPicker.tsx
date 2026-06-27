import { useEffect, useRef, useState } from "react";

type Col = { label: string; values: number[]; pad?: number };

const ROW_H = 52;

export function WheelPicker({
  columns,
  value,
  onChange,
}: {
  columns: Col[];
  value: number[];
  onChange: (v: number[]) => void;
}) {
  return (
    <div
      className="relative flex items-stretch justify-between gap-0.5 rounded-2xl bg-white/70 px-1 py-2 backdrop-blur-md"
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="pointer-events-none absolute left-2 right-2 top-1/2 z-0 -translate-y-1/2 rounded-xl bg-primary/15 ring-1 ring-primary/25"
        style={{ height: ROW_H }}
      />
      {columns.map((c, ci) => (
        <Column
          key={ci}
          col={c}
          value={value[ci]}
          onChange={(v) => {
            const next = [...value];
            next[ci] = v;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function Column({ col, value, onChange }: { col: Col; value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | null>(null);
  const dragging = useRef(false);
  const [internal, setInternal] = useState(value);

  const scrollToValue = (v: number, smooth = false) => {
    const idx = col.values.indexOf(v);
    if (idx >= 0 && ref.current) {
      ref.current.scrollTo({ top: idx * ROW_H, behavior: smooth ? "smooth" : "auto" });
      setInternal(v);
    }
  };

  useEffect(() => {
    scrollToValue(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value !== internal && !dragging.current) scrollToValue(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onScroll = () => {
    if (!ref.current) return;
    dragging.current = true;
    const raw = ref.current.scrollTop / ROW_H;
    const idx = Math.round(raw);
    const v = col.values[Math.max(0, Math.min(col.values.length - 1, idx))];
    if (v !== internal) setInternal(v);

    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      dragging.current = false;
      if (!ref.current) return;
      const targetTop = idx * ROW_H;
      if (Math.abs(ref.current.scrollTop - targetTop) > 0.5) {
        ref.current.scrollTo({ top: targetTop, behavior: "smooth" });
      }
      if (v !== value) onChange(v);
    }, 120);
  };

  const padTop = ROW_H * 2;

  return (
    <div className="min-w-0 flex-1 text-center">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-soft/70">
        {col.label}
      </div>
      <div ref={ref} onScroll={onScroll} className="wheel-col relative">
        <div style={{ height: padTop }} aria-hidden />
        {col.values.map((v) => {
          const isActive = v === internal;
          return (
            <div
              key={v}
              className={`flex items-center justify-center font-num tabular-nums transition-all duration-150 ${
                isActive ? "text-ink text-[32px] font-bold" : "text-ink-soft/40 text-[22px]"
              }`}
              style={{ height: ROW_H, scrollSnapAlign: "center" }}
            >
              {String(v).padStart(col.pad ?? 0, "0")}
            </div>
          );
        })}
        <div style={{ height: padTop }} aria-hidden />
      </div>
    </div>
  );
}
