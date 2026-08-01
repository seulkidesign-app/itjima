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
  SHEET_BACKDROP_SOLID_CLASS,
  SHEET_BACKDROP_FADE,
  SHEET_DIM_MAX,
  MOTION_DURATION,
  MOTION_EASE,
} from "@/lib/motion";
import { rubberBand } from "@/lib/swipePhysics";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

/** Sheet open height fractions — Apple Maps–style detents (single open uses half). */
const DETENT = {
  collapsed: 0.28,
  half: 0.55,
  full: 0.92,
} as const;

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" &&
      element.getAttribute("hidden") === null,
  );
}

function isTopmostModal(panel: HTMLElement): boolean {
  const dialogs = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
  ).filter(
    (dialog) => dialog.getClientRects().length > 0 && !dialog.hasAttribute("hidden"),
  );
  return dialogs[dialogs.length - 1] === panel;
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
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const panelHeightRef = useRef(420);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const sync = () => setWideLayout(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      setDragging(false);
      return;
    }
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
      panelHeightRef.current = panel.offsetHeight || 420;
      const first = focusableElements(panel)[0];
      (first ?? panel).focus({ preventScroll: true });
    });

    const onKey = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel || !isTopmostModal(panel)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
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

  const h = panelHeightRef.current;
  const dismissAt = h * DETENT.collapsed;
  const dimProgress = Math.max(
    0,
    Math.min(1, 1 - dragY / Math.max(1, h * DETENT.half)),
  );
  const backdropOpacity = SHEET_DIM_MAX * dimProgress;

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
            className={`bottom-sheet-backdrop absolute inset-0 z-0 ${SHEET_BACKDROP_SOLID_CLASS}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: backdropOpacity }}
            exit={{ opacity: 0 }}
            transition={dragging ? { duration: 0 } : SHEET_BACKDROP_FADE}
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
            data-dragging={dragging ? "true" : "false"}
            drag={wideLayout ? false : "y"}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.08, bottom: 0.42 }}
            onDragStart={() => {
              setDragging(true);
              if (panelRef.current) {
                panelHeightRef.current = panelRef.current.offsetHeight || 420;
              }
            }}
            onDrag={(_, info) => {
              const raw = Math.max(0, info.offset.y);
              setDragY(rubberBand(raw, h * 0.55, 0.22));
            }}
            onDragEnd={(_, info) => {
              setDragging(false);
              if (wideLayout) {
                setDragY(0);
                return;
              }
              const vy = info.velocity.y;
              const y = Math.max(0, info.offset.y);
              // Velocity snap: fling down or past collapsed detent → dismiss
              if (y > dismissAt || vy > 500) {
                light();
                onClose();
                return;
              }
              setDragY(0);
            }}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            transition={
              wideLayout
                ? { duration: MOTION_DURATION, ease: MOTION_EASE }
                : SPRING_SHEET
            }
            className="bottom-sheet-panel itjima-glass-panel sheet-chrome relative z-[1] mx-auto mt-auto flex min-h-0 w-full max-h-[var(--sheet-max-h)] shrink flex-col overflow-hidden"
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
            <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
