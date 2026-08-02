import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { composerSafetyState, focusComposer } from "@/lib/composerSafety";
import {
  APP_UPDATE_READY_EVENT,
  activateWaitingServiceWorker,
  hasWaitingServiceWorker,
  type AppUpdateStrategy,
} from "@/lib/swReminders";

const APP_UPDATE_TOAST_ID = "itjima-app-update";

/**
 * Cross-device interaction controller.
 * - Tracks keyboard vs pointer modality for precise focus/hover behavior.
 * - Adds desktop shortcuts without changing mobile/tablet behavior.
 * - Offers app updates without reloading while the composer has unsaved content.
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
    let updateReady = false;
    let updateStrategy: AppUpdateStrategy = "service-worker";
    let composerWatch: number | null = null;

    const clearComposerWatch = () => {
      if (composerWatch !== null) {
        window.clearInterval(composerWatch);
        composerWatch = null;
      }
    };

    const activateUpdate = () => {
      const composer = composerSafetyState();
      if (composer.dirty) {
        focusComposer();
        toast.warning(
          t(
            composer.hasImages
              ? "첨부한 이미지가 있어요. 먼저 던진 뒤 업데이트해 주세요."
              : "작성 중인 내용을 먼저 던진 뒤 업데이트해 주세요.",
            composer.hasImages
              ? "You have attached images. Drop them first, then update."
              : "Drop what you are writing first, then update.",
          ),
          { id: APP_UPDATE_TOAST_ID, duration: 4_000 },
        );
        return;
      }

      clearComposerWatch();
      toast.loading(t("최신 버전으로 여는 중이에요", "Opening the latest version"), {
        id: APP_UPDATE_TOAST_ID,
      });

      if (updateStrategy === "reload") {
        window.location.reload();
        return;
      }

      void activateWaitingServiceWorker().then((activated) => {
        if (activated) {
          window.location.reload();
          return;
        }
        // The waiting worker may already have activated. A network-first reload
        // still retrieves the latest HTML and hashed application assets.
        window.location.reload();
      });
    };

    const showReadyToast = () => {
      if (disposed || !updateReady) return;
      const composer = composerSafetyState();

      if (composer.dirty) {
        toast(t("새 버전이 준비됐어요", "A new version is ready"), {
          id: APP_UPDATE_TOAST_ID,
          duration: Infinity,
          description: t(
            "작성 중인 내용을 먼저 던지면 업데이트 버튼이 나타나요.",
            "Drop your current thought first, then the update button will appear.",
          ),
          action: {
            label: t("입력창 보기", "Go to composer"),
            onClick: () => {
              if (!focusComposer() && pathname !== "/") {
                void navigate({ to: "/" }).then(() => {
                  window.setTimeout(() => focusComposer(), 120);
                });
              }
            },
          },
        });

        if (composerWatch === null) {
          composerWatch = window.setInterval(() => {
            if (!composerSafetyState().dirty) {
              clearComposerWatch();
              showReadyToast();
            }
          }, 500);
        }
        return;
      }

      clearComposerWatch();
      toast(t("새 버전이 준비됐어요", "A new version is ready"), {
        id: APP_UPDATE_TOAST_ID,
        duration: Infinity,
        description: t(
          "지금 업데이트하면 최신 화면으로 다시 열려요.",
          "Update now to reopen with the latest version.",
        ),
        action: {
          label: t("지금 업데이트", "Update now"),
          onClick: activateUpdate,
        },
      });
    };

    const markUpdateReady = (strategy: AppUpdateStrategy) => {
      // A waiting service worker must activate before reload, so it takes
      // priority when both update signals arrive.
      if (!updateReady || strategy === "service-worker") {
        updateStrategy = strategy;
      }
      updateReady = true;
      showReadyToast();
    };

    const onUpdateReady = (event: Event) => {
      const customEvent = event as CustomEvent<{
        strategy?: AppUpdateStrategy;
      }>;
      markUpdateReady(customEvent.detail?.strategy ?? "service-worker");
    };
    window.addEventListener(APP_UPDATE_READY_EVENT, onUpdateReady);
    void hasWaitingServiceWorker().then((waiting) => {
      if (waiting) markUpdateReady("service-worker");
    });

    return () => {
      disposed = true;
      clearComposerWatch();
      window.removeEventListener(APP_UPDATE_READY_EVENT, onUpdateReady);
      toast.dismiss(APP_UPDATE_TOAST_ID);
    };
  }, [navigate, pathname, t]);

  return null;
}
