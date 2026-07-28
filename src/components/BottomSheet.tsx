import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useT } from "@/lib/i18n";
import { light } from "@/lib/haptics";
import {
  SPRING_SHEET,
  SHEET_BACKDROP_CLASS,
  SHEET_BACKDROP_FADE,
} from "@/lib/motion";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" &&
      element.getAttribute("hidden") === null,
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 0–1 height snap; default ~half sheet */
  maxHeight?: string;
  title?: string;
};

export function BottomSheet({
  open,
  onClose,
  children,
  maxHeight = "72dvh",
  title,
}: Props) {
  const t = useT();
  const dragControls = useDragControls();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [wideLayout, setWideLayout] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const sync = () => setWideLayout(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset > 40 ? inset : 0);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = focusableElements(panel)[0];
      (first ?? panel).focus({ preventScroll: true });
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = focusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKey);
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      });
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const scroll = document.getElementById("phone-scroll");
    const prevOverflow = scroll?.style.overflow ?? "";
    const prevBody = document.body.style.overflow;
    if (scroll) scroll.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (scroll) scroll.style.overflow = prevOverflow;
      document.body.style.overflow = prevBody;
    };
  }, [open]);

  const panelInitial = wideLayout
    ? { opacity: 0, y: 18, scale: 0.985 }
    : { opacity: 1, y: "100%", scale: 1 };
  const panelAnimate = { opacity: 1, y: 0, scale: 1 };
  const panelExit = wideLayout
    ? { opacity: 0, y: 12, scale: 0.99 }
    : { opacity: 1, y: "100%", scale: 1 };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="bottom-sheet-root fixed inset-0 z-[80] flex min-w-0 flex-col"
          role="presentation"
          data-layout={wideLayout ? "panel" : "sheet"}
        >
          <motion.button
            type="button"
            tabIndex={-1}
            aria-label={t("닫기", "Close")}
            className={`bottom-sheet-backdrop absolute inset-0 z-0 ${SHEET_BACKDROP_CLASS}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SHEET_BACKDROP_FADE}
            onClick={() => {
              light();
              onClose();
            }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            drag={wideLayout ? false : "y"}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.32 }}
            onDragEnd={(_, info) => {
              if (wideLayout) return;
              if (info.offset.y > 88 || info.velocity.y > 520) {
                light();
                onClose();
              }
            }}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            transition={
              wideLayout
                ? { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }
                : SPRING_SHEET
            }
            className="bottom-sheet-panel itjima-glass-panel sheet-chrome relative z-[1] mx-auto mt-auto flex w-full max-h-[var(--sheet-max-h)] shrink-0 flex-col overflow-hidden"
            style={
              {
                "--sheet-max-h": maxHeight,
                paddingBottom:
                  keyboardInset > 0
                    ? keyboardInset
                    : "env(safe-area-inset-bottom)",
              } as CSSProperties
            }
          >
            {title && (
              <span id={titleId} className="sr-only">
                {title}
              </span>
            )}
            {!wideLayout && (
              <div
                className="bottom-sheet-handle flex shrink-0 cursor-grab justify-center py-3 active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
                aria-hidden
              >
                <div className="h-1 w-9 rounded-full bg-ink/12" />
              </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
