import { useEffect, useRef, useState } from "react";

/** Detect fast scroll on #phone-scroll for subtle list compression. */
export function usePhoneScrollCompress(threshold = 1.15) {
  const [compress, setCompress] = useState(false);
  const timer = useRef<number | null>(null);
  const last = useRef({ y: 0, t: 0 });

  useEffect(() => {
    const el = document.getElementById("phone-scroll");
    if (!el) return;

    const onScroll = () => {
      const now = performance.now();
      const dt = Math.max(8, now - last.current.t);
      const dy = Math.abs(el.scrollTop - last.current.y);
      const vel = dy / dt;
      last.current = { y: el.scrollTop, t: now };

      if (vel > threshold) {
        setCompress(true);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCompress(false), 120);
      }
    };

    last.current = { y: el.scrollTop, t: performance.now() };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [threshold]);

  return compress;
}
