/** Service worker registration only — no client-side reminder scheduling. */

export const APP_UPDATE_READY_EVENT = "itjima:app-update-ready";

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let activeRegistration: ServiceWorkerRegistration | null = null;
let lastUpdateCheckAt = 0;
let lifecycleListenersInstalled = false;

function emitUpdateReady() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_UPDATE_READY_EVENT));
}

function watchRegistration(registration: ServiceWorkerRegistration) {
  const notifyIfWaiting = () => {
    if (registration.waiting && navigator.serviceWorker.controller) {
      emitUpdateReady();
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

  window.addEventListener("online", () => {
    void checkForUpdate(registration);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void checkForUpdate(registration);
    }
  });
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
