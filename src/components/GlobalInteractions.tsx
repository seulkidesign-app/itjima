import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

/**
 * Cross-device interaction controller.
 * - Tracks keyboard vs pointer modality for precise focus/hover behavior.
 * - Adds desktop shortcuts without changing mobile/tablet behavior.
 */
export function GlobalInteractions() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

  return null;
}
