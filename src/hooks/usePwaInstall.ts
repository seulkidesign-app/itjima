import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/analytics";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

export function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent)
  );
}

const DISMISS_KEY = "itjima_pwa_install_dismissed_at";
const DISMISS_DAYS = 7;

function recentlyDismissed() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    return (Date.now() - Number(v)) / 86400000 < DISMISS_DAYS;
  } catch {
    return false;
  }
}

export function usePwaInstall() {
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const [dismissed, setDismissed] = useState(recentlyDismissed);
  const standalone = isStandalonePwa();

  useEffect(() => {
    if (standalone) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
    };
    const onInstalled = () => {
      track("pwa_installed", { platform: isIosSafari() ? "ios" : "android" });
    };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [standalone]);

  const canInstall =
    !standalone && !dismissed && (Boolean(bip) || isIosSafari());

  const dismissInstall = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setDismissed(true);
    track("pwa_install_dismissed");
  }, []);

  const install = useCallback(async () => {
    track("pwa_install_shown");
    if (bip) {
      track("pwa_install_prompted", { platform: "android" });
      await bip.prompt();
      const res = await bip.userChoice;
      track("pwa_install_choice", {
        platform: "android",
        outcome: res.outcome,
      });
      if (res.outcome === "accepted") track("pwa_install_accepted");
      else dismissInstall();
      return;
    }
    if (isIosSafari()) {
      track("pwa_install_prompted", { platform: "ios" });
      setIosHintOpen(true);
    }
  }, [bip, dismissInstall]);

  return {
    canInstall,
    install,
    dismissInstall,
    iosHintOpen,
    closeIosHint: () => {
      setIosHintOpen(false);
      dismissInstall();
    },
  };
}
