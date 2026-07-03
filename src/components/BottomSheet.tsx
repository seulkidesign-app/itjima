import { type CSSProperties, type ReactNode, useEffect, useId } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useT } from "@/lib/i18n";
import { light } from "@/lib/haptics";
import { SPRING_SHEET, EASE_OUT_APP } from "@/lib/motion";

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
  maxHeight = "72vh",
  title,
}: Props) {
  const t = useT();
  const dragControls = useDragControls();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  return (
    <AnimatePresence>
      {open && (
        <div
          className="absolute inset-0 z-[80] flex flex-col"
          role="presentation"
        >
          <motion.button
            type="button"
            aria-label={t("닫기", "Close")}
            className="min-h-0 w-full flex-1 bg-ink/35 backdrop-blur-md backdrop-saturate-150"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT_APP }}
            onClick={() => {
              light();
              onClose();
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.32 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 88 || info.velocity.y > 520) {
                light();
                onClose();
              }
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING_SHEET}
            onAnimationComplete={(def) => {
              if (def === "animate") light();
            }}
            className="sheet-chrome relative w-full shrink-0 max-h-[var(--sheet-max-h)] overflow-hidden bg-white/98 shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.22)] backdrop-blur-2xl"
            style={{ "--sheet-max-h": maxHeight } as CSSProperties}
          >
            {title && (
              <span id={titleId} className="sr-only">
                {title}
              </span>
            )}
            <div
              className="flex cursor-grab justify-center py-3 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
              aria-hidden
            >
              <div className="h-1 w-9 rounded-full bg-ink/12" />
            </div>
            <div className="pb-[env(safe-area-inset-bottom)]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
