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

export function usePwaInstall() {
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [iosHintOpen, setIosHintOpen] = useState(false);
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

  const canInstall = !standalone && (Boolean(bip) || isIosSafari());

  const install = useCallback(async () => {
    if (bip) {
      track("pwa_install_prompted", { platform: "android" });
      await bip.prompt();
      const res = await bip.userChoice;
      track("pwa_install_choice", {
        platform: "android",
        outcome: res.outcome,
      });
      return;
    }
    if (isIosSafari()) {
      track("pwa_install_prompted", { platform: "ios" });
      setIosHintOpen(true);
    }
  }, [bip]);

  return {
    canInstall,
    install,
    iosHintOpen,
    closeIosHint: () => setIosHintOpen(false),
  };
}
