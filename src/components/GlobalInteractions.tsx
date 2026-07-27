import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import {
  APP_UPDATE_READY_EVENT,
  activateWaitingServiceWorker,
  hasWaitingServiceWorker,
} from "@/lib/swReminders";

const APP_UPDATE_TOAST_ID = "itjima-app-update";

/**
 * Cross-device interaction controller.
 * - Tracks keyboard vs pointer modality for precise focus/hover behavior.
 * - Adds desktop shortcuts without changing mobile/tablet behavior.
 * - Offers app updates without reloading while the user is typing.
 */
export function GlobalInteractions() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();

  useEffect(() => {
    const root = document.documentElement;

    const markKeyboard = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      root.dataset.inputModality = "keyboard";
    };
    const markPointer = (event: PointerEvent) => {
      root.dataset.inputModality = event.pointerType === "touch" ? "touch" : "pointer";
    };

    window.addEventListener("keydown", markKeyboard, true);
    window.addEventListener("pointerdown", markPointer, true);
    return () => {
      window.removeEventListener("keydown", markKeyboard, true);
      window.removeEventListener("pointerdown", markPointer, true);
    };
  }, []);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.matches("input, textarea, select, [contenteditable='true']") ?? false;

      if (event.key === "1") {
        event.preventDefault();
        void navigate({ to: "/" });
      } else if (event.key === "2") {
        event.preventDefault();
        void navigate({ to: "/schedule" });
      } else if (event.key === "3") {
        event.preventDefault();
        void navigate({ to: "/archive" });
      } else if (event.key.toLowerCase() === "k" && !isEditable) {
        event.preventDefault();
        if (pathname !== "/") {
          void navigate({ to: "/" }).then(() => {
            window.setTimeout(() => document.getElementById("capture-input")?.focus(), 120);
          });
        } else {
          document.getElementById("capture-input")?.focus();
        }
      }
    };

    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [navigate, pathname]);

  useEffect(() => {
    let disposed = false;

    const showUpdateToast = () => {
      if (disposed) return;
      toast(t("새 버전이 준비됐어요", "A new version is ready"), {
        id: APP_UPDATE_TOAST_ID,
        duration: Infinity,
        description: t(
          "작성 중인 내용은 그대로 두고, 준비됐을 때 업데이트하세요.",
          "Your current work stays here. Update when you are ready.",
        ),
        action: {
          label: t("업데이트", "Update"),
          onClick: () => {
            toast.loading(t("업데이트 중이에요", "Updating"), {
              id: APP_UPDATE_TOAST_ID,
            });
            void activateWaitingServiceWorker().then((activated) => {
              if (activated) {
                window.location.reload();
                return;
              }
              toast.error(
                t(
                  "업데이트를 적용하지 못했어요. 잠시 후 다시 시도해 주세요.",
                  "The update could not be applied. Please try again shortly.",
                ),
                { id: APP_UPDATE_TOAST_ID, duration: 5_000 },
              );
            });
          },
        },
      });
    };

    const onUpdateReady = () => showUpdateToast();
    window.addEventListener(APP_UPDATE_READY_EVENT, onUpdateReady);
    void hasWaitingServiceWorker().then((waiting) => {
      if (waiting) showUpdateToast();
    });

    return () => {
      disposed = true;
      window.removeEventListener(APP_UPDATE_READY_EVENT, onUpdateReady);
      toast.dismiss(APP_UPDATE_TOAST_ID);
    };
  }, [t]);

  return null;
}
