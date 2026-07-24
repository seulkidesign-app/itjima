import {
  useRef,
  type PointerEvent,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
  onLongPress: () => void;
  disabled?: boolean;
};

export function ChatLongPressRow({ children, onLongPress, disabled }: Props) {
  const draggingRef = useRef(false);
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  const clearLongPress = () => {
    if (longTimer.current) {
      window.clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    draggingRef.current = true;
    longFired.current = false;
    moved.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longTimer.current = window.setTimeout(() => {
      if (draggingRef.current && !moved.current) {
        longFired.current = true;
        onLongPress();
      }
    }, 480);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = Math.abs(e.clientX - start.current.x);
    const dy = Math.abs(e.clientY - start.current.y);
    if (dx > 6 || dy > 6) {
      moved.current = true;
      clearLongPress();
    }
  };

  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    clearLongPress();
  };

  return (
    <div
      className="relative w-full min-w-0 py-0.5"
      style={{ touchAction: "pan-y" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {children}
    </div>
  );
}
