import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  onDone: (dataUrl: string) => void;
};

export function ScribbleCanvas({ open, onClose, onDone }: Props) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHasStroke(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0A0A0A";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [open]);

  if (!open) return null;

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasStroke(true);
  };

  const onPointerUp = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const done = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) {
      onClose();
      return;
    }
    onDone(canvas.toDataURL("image/png"));
    onClose();
  };

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mt-auto animate-slide-up rounded-t-[28px] bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" />
        <div className="mb-3 text-center text-[15px] font-bold text-ink">{t("낙서", "Scribble")}</div>
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          className="aspect-[5/3] w-full touch-none rounded-2xl border border-ink/10 bg-white"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={clear}
            className="flex-1 rounded-2xl border border-ink/10 py-3 text-sm font-semibold text-ink-soft"
          >
            {t("지우기", "Clear")}
          </button>
          <button
            type="button"
            onClick={done}
            className="flex-1 rounded-2xl bg-primary py-3 text-sm font-bold text-ink"
          >
            {t("첨부", "Attach")}
          </button>
        </div>
      </div>
    </div>
  );
}
