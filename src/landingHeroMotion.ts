import "./ui-landing-ascii-signature.css";

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

const landingV2Selector =
  '.itjima-launch-page[data-landing-release="v2"] .landing-v2';

const asciiDrops = [
  [">", "6%", "0ms", "1.52s", "28px", "380deg"],
  ["_", "12%", "210ms", "1.72s", "-34px", "-320deg"],
  ["0", "19%", "70ms", "1.62s", "42px", "430deg"],
  ["*", "26%", "330ms", "1.48s", "-22px", "-390deg"],
  ["i", "33%", "130ms", "1.84s", "35px", "300deg"],
  ["<", "40%", "390ms", "1.58s", "-48px", "-420deg"],
  ["j", "47%", "40ms", "1.69s", "26px", "360deg"],
  [">_<", "54%", "270ms", "1.9s", "-38px", "-280deg"],
  ["*", "61%", "110ms", "1.54s", "44px", "440deg"],
  ["0_0", "68%", "430ms", "1.86s", "-31px", "-350deg"],
  ["_", "75%", "190ms", "1.64s", "30px", "390deg"],
  ["<", "82%", "20ms", "1.78s", "-40px", "-450deg"],
  ["i", "87%", "350ms", "1.56s", "36px", "310deg"],
  ["j", "91%", "150ms", "1.72s", "-26px", "-370deg"],
  ["*", "95%", "460ms", "1.61s", "24px", "420deg"],
  [">ij<", "73%", "510ms", "1.94s", "-52px", "-300deg"],
] as const;

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

function makeAsciiHeroScene() {
  const scene = document.createElement("div");
  scene.className = "ij-ascii-hero";
  scene.setAttribute("aria-hidden", "true");

  [">_<", "0_0", "**__**"].forEach((text, index) => {
    const face = document.createElement("span");
    face.className = "ij-ascii-face";
    face.dataset.face = String(index + 1);
    face.textContent = text;
    scene.append(face);
  });

  const mark = document.createElement("span");
  mark.className = "ij-ascii-mark";
  mark.textContent = ">ij<";
  scene.append(mark);

  return scene;
}

function makeAsciiRain() {
  const rain = document.createElement("div");
  rain.className = "ij-ascii-rain";
  rain.setAttribute("aria-hidden", "true");
  rain.dataset.rain = "false";

  asciiDrops.forEach(
    ([text, x, delay, duration, drift, spin]) => {
      const drop = document.createElement("span");
      drop.className = "ij-ascii-drop";
      drop.textContent = text;
      drop.style.setProperty("--ij-drop-x", x);
      drop.style.setProperty("--ij-drop-delay", delay);
      drop.style.setProperty("--ij-drop-duration", duration);
      drop.style.setProperty("--ij-drop-drift", drift);
      drop.style.setProperty("--ij-drop-spin", spin);
      rain.append(drop);
    },
  );

  return rain;
}

function installAsciiSignature(reducedMotion: boolean) {
  const root = document.getElementById("root") ?? document.documentElement;
  let mountedLanding: HTMLElement | null = null;
  let rainLayer: HTMLElement | null = null;
  let finalObserver: IntersectionObserver | null = null;

  const cleanup = () => {
    finalObserver?.disconnect();
    finalObserver = null;
    rainLayer?.remove();
    rainLayer = null;
    mountedLanding = null;
  };

  const mount = () => {
    const landing = document.querySelector<HTMLElement>(landingV2Selector);

    if (!landing) {
      if (mountedLanding && !mountedLanding.isConnected) cleanup();
      return;
    }

    if (landing === mountedLanding) return;
    cleanup();

    const hero = landing.querySelector<HTMLElement>(".lv2-hero");
    const brandBand = landing.querySelector<HTMLElement>(".lv2-brand-band");
    if (!hero || !brandBand) return;

    mountedLanding = landing;
    hero.append(makeAsciiHeroScene());

    if (reducedMotion) return;

    rainLayer = makeAsciiRain();
    document.body.append(rainLayer);

    if (!("IntersectionObserver" in window)) return;

    finalObserver = new IntersectionObserver(
      (entries) => {
        const reachedEnd = entries.some((entry) => entry.isIntersecting);
        if (!reachedEnd || !rainLayer) return;
        rainLayer.dataset.rain = "true";
        finalObserver?.disconnect();
        finalObserver = null;
      },
      { threshold: 0.18, rootMargin: "0px 0px -4%" },
    );
    finalObserver.observe(brandBand);
  };

  mount();
  const observer = new MutationObserver(mount);
  observer.observe(root, { childList: true, subtree: true });
}

function installLandingMotion() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const motionWindow = window as MotionWindow;
  if (motionWindow[INSTALL_KEY]) return;
  motionWindow[INSTALL_KEY] = true;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  installAsciiSignature(reducedMotion.matches);

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
