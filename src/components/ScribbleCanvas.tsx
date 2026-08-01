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
  const panelRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const keyboardDrawing = useRef(false);
  const keyboardPoint = useRef({ x: 400, y: 240 });
  const [hasStroke, setHasStroke] = useState(false);
  const [keyboardPenDown, setKeyboardPenDown] = useState(false);

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    keyboardPoint.current = { x: canvas.width / 2, y: canvas.height / 2 };
  };

  useEffect(() => {
    if (!open) return;
    setHasStroke(false);
    setKeyboardPenDown(false);
    keyboardDrawing.current = false;
    initializeCanvas();

    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      canvasRef.current?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
      });
    };
  }, [open, onClose]);

  if (!open) return null;

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const next = point(event);
    ctx.beginPath();
    ctx.moveTo(next.x, next.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const next = point(event);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    setHasStroke(true);
  };

  const onPointerUp = () => {
    drawing.current = false;
  };

  const clear = () => {
    initializeCanvas();
    setHasStroke(false);
    setKeyboardPenDown(false);
    keyboardDrawing.current = false;
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

  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      keyboardDrawing.current = !keyboardDrawing.current;
      setKeyboardPenDown(keyboardDrawing.current);
      return;
    }
    if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      clear();
      return;
    }

    const step = event.shiftKey ? 30 : 10;
    const delta =
      event.key === "ArrowLeft"
        ? { x: -step, y: 0 }
        : event.key === "ArrowRight"
          ? { x: step, y: 0 }
          : event.key === "ArrowUp"
            ? { x: 0, y: -step }
            : event.key === "ArrowDown"
              ? { x: 0, y: step }
              : null;
    if (!delta) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const previous = keyboardPoint.current;
    const next = {
      x: Math.max(0, Math.min(canvas.width, previous.x + delta.x)),
      y: Math.max(0, Math.min(canvas.height, previous.y + delta.y)),
    };
    if (keyboardDrawing.current) {
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      setHasStroke(true);
    }
    keyboardPoint.current = next;
  };

  return (
    <div className="absolute inset-0 z-[60] flex flex-col" role="presentation">
      <button
        type="button"
        aria-label={t("낙서 창 닫기", "Close scribble")}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="scribble-title"
        aria-describedby="scribble-instructions"
        className="relative mt-auto animate-slide-up rounded-t-[28px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/15" aria-hidden />
        <h2 id="scribble-title" className="mb-3 text-center text-[15px] font-bold text-ink">
          {t("낙서", "Scribble")}
        </h2>
        <p id="scribble-instructions" className="sr-only">
          {t(
            "손가락이나 포인터로 그리세요. 키보드는 스페이스로 펜을 켜고 화살표로 그리며 C로 지웁니다.",
            "Draw with touch or pointer. With a keyboard, press Space to toggle the pen, use arrow keys to draw, and C to clear.",
          )}
        </p>
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          tabIndex={0}
          role="application"
          aria-label={t(
            `낙서 영역. 키보드 펜 ${keyboardPenDown ? "켜짐" : "꺼짐"}`,
            `Scribble area. Keyboard pen ${keyboardPenDown ? "on" : "off"}`,
          )}
          className="aspect-[5/3] w-full touch-none rounded-[24px] bg-white shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onCanvasKeyDown}
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={clear}
            className="touch-press min-h-11 flex-1 rounded-full px-4 text-sm font-semibold text-ink-soft shadow-card"
          >
            {t("지우기", "Clear")}
          </button>
          <button
            type="button"
            onClick={done}
            className="touch-press min-h-11 flex-1 rounded-full bg-primary px-4 text-sm font-bold text-ink"
          >
            {t("첨부", "Attach")}
          </button>
        </div>
      </div>
    </div>
  );
}
