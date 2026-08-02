/** Service worker registration only — no client-side reminder scheduling. */

export type AppUpdateStrategy = "service-worker" | "reload";

export const APP_UPDATE_READY_EVENT = "itjima:app-update-ready";

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let activeRegistration: ServiceWorkerRegistration | null = null;
let lastUpdateCheckAt = 0;
let lastDocumentUpdateCheckAt = 0;
let lifecycleListenersInstalled = false;
let documentUpdateDetected = false;

function emitUpdateReady(strategy: AppUpdateStrategy) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(APP_UPDATE_READY_EVENT, {
      detail: { strategy },
    }),
  );
}

function normalizedAssetUrl(value: string, baseUrl: string): string | null {
  try {
    const parsed = new URL(value, baseUrl);
    if (!parsed.pathname.startsWith("/assets/")) return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function fingerprintFromDocument(doc: Document, baseUrl: string): string {
  const assets = [
    ...Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')).map(
      (node) => node.getAttribute("src") ?? "",
    ),
    ...Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')).map(
      (node) => node.getAttribute("href") ?? "",
    ),
  ]
    .map((value) => normalizedAssetUrl(value, baseUrl))
    .filter((value): value is string => Boolean(value))
    .sort();

  return assets.join("|");
}

export function extractBuildFingerprint(
  html: string,
  baseUrl = "https://itjima.app/",
): string {
  if (typeof DOMParser === "undefined") return "";
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return fingerprintFromDocument(parsed, baseUrl);
}

function currentBuildFingerprint(): string {
  if (typeof document === "undefined" || typeof window === "undefined") return "";
  return fingerprintFromDocument(document, window.location.href);
}

async function checkForDocumentUpdate() {
  if (
    typeof window === "undefined" ||
    documentUpdateDetected ||
    document.visibilityState === "hidden"
  ) {
    return;
  }

  const now = Date.now();
  if (now - lastDocumentUpdateCheckAt < 60_000) return;
  lastDocumentUpdateCheckAt = now;

  const current = currentBuildFingerprint();
  if (!current) return;

  try {
    const url = new URL("/", window.location.origin);
    url.searchParams.set("__itjima_update_check", String(now));
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "x-itjima-update-check": "1" },
    });
    if (!response.ok) return;

    const remote = extractBuildFingerprint(await response.text(), url.href);
    if (!remote || remote === current) return;

    documentUpdateDetected = true;
    emitUpdateReady("reload");
  } catch {
    // Update checks are best-effort. Normal app loading must never depend on them.
  }
}

function watchRegistration(registration: ServiceWorkerRegistration) {
  const notifyIfWaiting = () => {
    if (registration.waiting && navigator.serviceWorker.controller) {
      emitUpdateReady("service-worker");
    }
  };

  notifyIfWaiting();
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed") notifyIfWaiting();
    });
  });
}

async function checkForUpdate(registration: ServiceWorkerRegistration) {
  const now = Date.now();
  if (now - lastUpdateCheckAt < 60_000) return;
  lastUpdateCheckAt = now;
  await registration.update().catch(() => undefined);
}

function installLifecycleListeners(registration: ServiceWorkerRegistration) {
  if (lifecycleListenersInstalled || typeof window === "undefined") return;
  lifecycleListenersInstalled = true;

  const checkAllUpdates = () => {
    void checkForUpdate(registration);
    void checkForDocumentUpdate();
  };

  window.addEventListener("online", checkAllUpdates);
  window.addEventListener("focus", checkAllUpdates);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkAllUpdates();
  });
  window.setInterval(() => {
    if (document.visibilityState === "visible") checkAllUpdates();
  }, 5 * 60_000);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  if (import.meta.env.VITE_E2E === "true") {
    return null;
  }
  if (registrationPromise) return registrationPromise;

  registrationPromise = (async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      activeRegistration = registration;
      watchRegistration(registration);
      installLifecycleListeners(registration);
      void checkForUpdate(registration);
      void checkForDocumentUpdate();
      return registration;
    } catch {
      registrationPromise = null;
      return null;
    }
  })();

  return registrationPromise;
}

export async function hasWaitingServiceWorker(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }
  const registration =
    activeRegistration ?? (await navigator.serviceWorker.getRegistration("/"));
  return Boolean(registration?.waiting && navigator.serviceWorker.controller);
}

/** Activate a waiting app version. The caller decides when it is safe to reload. */
export async function activateWaitingServiceWorker(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  const registration =
    activeRegistration ?? (await navigator.serviceWorker.getRegistration("/"));
  const waiting = registration?.waiting;
  if (!waiting) return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (activated: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      resolve(activated);
    };
    const onControllerChange = () => finish(true);
    const timeout = window.setTimeout(() => finish(false), 6_000);

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    waiting.postMessage({ type: "SKIP_WAITING" });
  });
}

export async function unregisterServiceWorkers(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  activeRegistration = null;
  registrationPromise = null;
}

export function notificationPermissionState():
  | "granted"
  | "denied"
  | "default"
  | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}
