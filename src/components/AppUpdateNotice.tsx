import { useEffect } from "react";
import { toast } from "sonner";
import {
  APP_UPDATE_READY_EVENT,
  activateWaitingServiceWorker,
  clearPendingAppUpdateStrategy,
  getPendingAppUpdateStrategy,
  type AppUpdateStrategy,
} from "@/lib/swReminders";

const UPDATE_TOAST_ID = "itjima-app-update-ready";

function updateCopy() {
  const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
  return isEnglish
    ? { message: "A new version is ready.", action: "Update" }
    : { message: "새 버전이 준비됐어요.", action: "업데이트" };
}

async function applyUpdate(strategy: AppUpdateStrategy) {
  clearPendingAppUpdateStrategy();

  if (strategy === "service-worker") {
    await activateWaitingServiceWorker();
  }

  window.location.reload();
}

export function AppUpdateNotice() {
  useEffect(() => {
    let applying = false;

    const showUpdate = (strategy: AppUpdateStrategy) => {
      const copy = updateCopy();
      toast(copy.message, {
        id: UPDATE_TOAST_ID,
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: copy.action,
          onClick: () => {
            if (applying) return;
            applying = true;
            toast.loading(copy.message, { id: UPDATE_TOAST_ID });
            void applyUpdate(strategy);
          },
        },
      });
    };

    const pending = getPendingAppUpdateStrategy();
    if (pending) showUpdate(pending);

    const onUpdateReady = (event: Event) => {
      const strategy = (event as CustomEvent<{ strategy?: AppUpdateStrategy }>).detail?.strategy;
      if (strategy === "service-worker" || strategy === "reload") {
        showUpdate(strategy);
      }
    };

    window.addEventListener(APP_UPDATE_READY_EVENT, onUpdateReady);
    return () => window.removeEventListener(APP_UPDATE_READY_EVENT, onUpdateReady);
  }, []);

  return null;
}
