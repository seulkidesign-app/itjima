import { type CSSProperties, type ReactNode, useEffect, useId } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useT } from "@/lib/i18n";
import { SPRING_SHEET } from "@/lib/motion";

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

  return (
    <AnimatePresence>
      {open && (
        <div
          className="absolute inset-0 z-[80] flex flex-col justify-end"
          role="presentation"
        >
          <motion.button
            type="button"
            aria-label={t("닫기", "Close")}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.28 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 88 || info.velocity.y > 520) onClose();
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING_SHEET}
            className="relative max-h-[var(--sheet-max-h)] overflow-hidden rounded-t-[28px] bg-white shadow-[0_-16px_56px_-8px_rgba(0,0,0,0.22)]"
            style={{ "--sheet-max-h": maxHeight } as CSSProperties}
            onClick={(e) => e.stopPropagation()}
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
              <div className="h-1.5 w-10 rounded-full bg-ink/15" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
