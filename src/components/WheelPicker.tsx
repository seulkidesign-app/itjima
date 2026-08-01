import { useEffect, useId, useRef, useState } from "react";

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
    <div className="relative flex items-stretch justify-between gap-0.5 rounded-[24px] bg-white/70 px-1 py-2 shadow-card backdrop-blur-md">
      {columns.map((c, ci) => (
        <Column
          key={`${c.label}-${ci}`}
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

function Column({
  col,
  value,
  onChange,
}: {
  col: Col;
  value: number;
  onChange: (v: number) => void;
}) {
  const labelId = `${useId()}-label`;
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | null>(null);
  const dragging = useRef(false);
  const [internal, setInternal] = useState(value);

  const scrollToValue = (v: number, smooth = false) => {
    const idx = col.values.indexOf(v);
    if (idx >= 0 && ref.current) {
      ref.current.scrollTo({
        top: idx * ROW_H,
        behavior: smooth ? "smooth" : "auto",
      });
      setInternal(v);
    }
  };

  const commitIndex = (index: number, smooth = true) => {
    const bounded = Math.max(0, Math.min(col.values.length - 1, index));
    const next = col.values[bounded];
    scrollToValue(next, smooth);
    if (next !== value) onChange(next);
  };

  useEffect(() => {
    scrollToValue(value);
    return () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    };
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
    const bounded = Math.max(0, Math.min(col.values.length - 1, idx));
    const v = col.values[bounded];
    if (v !== internal) setInternal(v);

    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      dragging.current = false;
      if (!ref.current) return;
      const targetTop = bounded * ROW_H;
      if (Math.abs(ref.current.scrollTop - targetTop) > 0.5) {
        ref.current.scrollTo({ top: targetTop, behavior: "smooth" });
      }
      if (v !== value) onChange(v);
    }, 120);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = Math.max(0, col.values.indexOf(internal));
    let nextIndex: number | null = null;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = index - 1;
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = index + 1;
    } else if (event.key === "PageUp") {
      nextIndex = index - 5;
    } else if (event.key === "PageDown") {
      nextIndex = index + 5;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = col.values.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    commitIndex(nextIndex);
  };

  const padTop = ROW_H * 2;

  return (
    <div className="min-w-0 flex-1 text-center">
      <div
        id={labelId}
        className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft/70"
      >
        {col.label}
      </div>
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 rounded-[20px] bg-primary/15"
          style={{ height: ROW_H }}
          aria-hidden
        />
        <div
          ref={ref}
          role="spinbutton"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-valuemin={col.values[0]}
          aria-valuemax={col.values[col.values.length - 1]}
          aria-valuenow={internal}
          aria-valuetext={String(internal).padStart(col.pad ?? 0, "0")}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          className="wheel-col relative z-[1] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div style={{ height: padTop }} aria-hidden />
          {col.values.map((v) => {
            const isActive = v === internal;
            return (
              <div
                key={v}
                aria-hidden={!isActive}
                className={`flex items-center justify-center font-num tabular-nums transition-all duration-150 ${
                  isActive
                    ? "text-ink text-[32px] font-bold"
                    : "text-ink-soft/40 text-[22px]"
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
    </div>
  );
}
