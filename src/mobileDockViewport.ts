/**
 * Keep persistent mobile controls attached to the visible viewport when the
 * software keyboard changes iOS Safari's VisualViewport without resizing the
 * layout viewport.
 */
declare global {
  interface Window {
    __itjimaMobileDockViewport?: boolean;
  }
}

function installMobileDockViewport() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__itjimaMobileDockViewport) return;
  window.__itjimaMobileDockViewport = true;

  const visualViewport = window.visualViewport;
  if (!visualViewport) return;

  let frame = 0;

  const sync = () => {
    frame = 0;

    if (!window.matchMedia("(max-width: 639px)").matches) {
      document.documentElement.style.setProperty("--ij-keyboard-inset", "0px");
      return;
    }

    const visualBottom = visualViewport.offsetTop + visualViewport.height;
    const rawInset = Math.max(0, window.innerHeight - visualBottom);

    // Ignore normal browser chrome movement. Keyboard occlusion is much larger.
    const keyboardInset = rawInset >= 120 ? Math.round(rawInset) : 0;
    document.documentElement.style.setProperty(
      "--ij-keyboard-inset",
      `${keyboardInset}px`,
    );
  };

  const scheduleSync = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(sync);
  };

  visualViewport.addEventListener("resize", scheduleSync, { passive: true });
  visualViewport.addEventListener("scroll", scheduleSync, { passive: true });
  window.addEventListener("resize", scheduleSync, { passive: true });
  window.addEventListener("orientationchange", scheduleSync, { passive: true });
  document.addEventListener("focusin", scheduleSync);
  document.addEventListener("focusout", scheduleSync);

  scheduleSync();
}

installMobileDockViewport();

export {};
