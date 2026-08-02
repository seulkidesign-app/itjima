export type PwaInstallMode = "installed" | "prompt" | "ios" | "manual";
export type PwaInstallOutcome = "accepted" | "dismissed" | "unavailable";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform?: string;
};

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type Listener = () => void;

let deferredPrompt: DeferredInstallPrompt | null = null;
let listenersInstalled = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const classicIos = /iPad|iPhone|iPod/.test(ua);
  const ipadDesktopMode =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return classicIos || ipadDesktopMode;
}

export function getPwaInstallMode(): PwaInstallMode {
  if (isPwaStandalone()) return "installed";
  if (deferredPrompt) return "prompt";
  if (isIosDevice()) return "ios";
  return "manual";
}

export function subscribePwaInstall(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaInstallSnapshot(): PwaInstallMode {
  return getPwaInstallMode();
}

export function installPwaInstallListeners(): void {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as DeferredInstallPrompt;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener?.("change", notify);
}

export async function requestPwaInstall(): Promise<PwaInstallOutcome> {
  const prompt = deferredPrompt;
  if (!prompt) return "unavailable";

  deferredPrompt = null;
  notify();

  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") {
      notify();
      return "accepted";
    }
    return "dismissed";
  } catch {
    return "unavailable";
  }
}

installPwaInstallListeners();
