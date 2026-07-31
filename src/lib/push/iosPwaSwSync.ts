import { detectPushPlatform } from "@/lib/push/detectPushPlatform";
import { ensurePushSubscriptionForCurrentUser } from "@/lib/push/pushSubscription";
import {
  activateWaitingServiceWorker,
  registerServiceWorker,
} from "@/lib/swReminders";

let installed = false;

/** Activate waiting SW immediately on iOS PWA and refresh push binding. */
export function installIosPwaServiceWorkerSync(): void {
  if (installed || typeof window === "undefined") return;
  if (detectPushPlatform() !== "ios-pwa") return;
  installed = true;

  void (async () => {
    const registration = await registerServiceWorker();
    if (!registration) return;

    if (registration.waiting) {
      await activateWaitingServiceWorker();
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      void ensurePushSubscriptionForCurrentUser();
    });
  })();
}
