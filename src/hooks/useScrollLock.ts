import { useEffect } from "react";

/** Locks #phone-scroll and body while overlays are open (iOS scroll bleed). */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const scroll = document.getElementById("phone-scroll");
    const prevOverflow = scroll?.style.overflow ?? "";
    const prevBody = document.body.style.overflow;
    if (scroll) scroll.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (scroll) scroll.style.overflow = prevOverflow;
      document.body.style.overflow = prevBody;
    };
  }, [active]);
}
