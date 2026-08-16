const INSTALL_KEY = "__itjimaLandingMotionInstalled";

type MotionWindow = Window & {
  __itjimaLandingMotionInstalled?: boolean;
};

const heroSelector = ".itjima-launch-page .landing-motion-demo-wrap";
const surfaceSelector = [
  ".itjima-launch-page #how article",
  ".itjima-launch-page main > section:nth-of-type(4) article",
  ".itjima-launch-page .landing-motion-final",
].join(",");
const magneticSelector = [
  ".itjima-launch-page .landing-motion-header-cta",
  ".itjima-launch-page .landing-motion-primary-cta",
  ".itjima-launch-page .landing-motion-secondary-cta",
].join(",");

function normalizedPointer(element: HTMLElement, clientX: number, clientY: number) {
  const rect = element.getBoundingClientRect();
  const px = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const py = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  return {
    x: px * 2 - 1,
    y: py * 2 - 1,
    px: px * 100,
    py: py * 100,
  };
}

function setPointerVars(element: HTMLElement, clientX: number, clientY: number) {
  const { x, y, px, py } = normalizedPointer(element, clientX, clientY);
  element.style.setProperty("--ij-pointer-x", x.toFixed(4));
  element.style.setProperty("--ij-pointer-y", y.toFixed(4));
  element.style.setProperty("--ij-pointer-px", `${px.toFixed(2)}%`);
  element.style.setProperty("--ij-pointer-py", `${py.toFixed(2)}%`);
}

function resetPointerVars(element: HTMLElement) {
  element.style.setProperty("--ij-pointer-x", "0");
  element.style.setProperty("--ij-pointer-y", "0");
  element.style.setProperty("--ij-pointer-px", "50%");
  element.style.setProperty("--ij-pointer-py", "50%");
}

function installLandingMotion() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const motionWindow = window as MotionWindow;
  if (motionWindow[INSTALL_KEY]) return;
  motionWindow[INSTALL_KEY] = true;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (reducedMotion.matches || !precisePointer.matches) return;

  let heroFrame = 0;
  let pendingHero: { element: HTMLElement; x: number; y: number } | null = null;

  const flushHero = () => {
    heroFrame = 0;
    if (!pendingHero) return;
    const { element, x, y } = pendingHero;
    pendingHero = null;
    setPointerVars(element, x, y);
    element.dataset.heroActive = "true";
  };

  document.addEventListener(
    "pointermove",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const hero = target.closest<HTMLElement>(heroSelector);
      if (hero) {
        pendingHero = { element: hero, x: event.clientX, y: event.clientY };
        if (!heroFrame) heroFrame = window.requestAnimationFrame(flushHero);
      }

      const magnetic = target.closest<HTMLElement>(magneticSelector);
      if (magnetic) {
        const { x, y } = normalizedPointer(magnetic, event.clientX, event.clientY);
        magnetic.style.setProperty("--ij-magnet-x", (x * 5.5).toFixed(2));
        magnetic.style.setProperty("--ij-magnet-y", (y * 4).toFixed(2));
        magnetic.dataset.magneticActive = "true";
      }

      const surface = target.closest<HTMLElement>(surfaceSelector);
      if (surface && !hero) {
        setPointerVars(surface, event.clientX, event.clientY);
        surface.dataset.pointerActive = "true";
      }
    },
    { passive: true },
  );

  document.addEventListener(
    "pointerout",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;

      const hero = target.closest<HTMLElement>(heroSelector);
      if (hero && (!related || !hero.contains(related))) {
        hero.dataset.heroActive = "false";
        resetPointerVars(hero);
      }

      const magnetic = target.closest<HTMLElement>(magneticSelector);
      if (magnetic && (!related || !magnetic.contains(related))) {
        magnetic.dataset.magneticActive = "false";
        magnetic.style.setProperty("--ij-magnet-x", "0");
        magnetic.style.setProperty("--ij-magnet-y", "0");
      }

      const surface = target.closest<HTMLElement>(surfaceSelector);
      if (surface && (!related || !surface.contains(related))) {
        surface.dataset.pointerActive = "false";
        resetPointerVars(surface);
      }
    },
    { passive: true },
  );
}

installLandingMotion();
