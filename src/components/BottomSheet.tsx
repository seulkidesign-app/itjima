import { type CSSProperties, type ReactNode, useEffect } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { SPRING_SHEET } from "@/lib/motion";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 0–1 height snap; default ~half sheet */
  maxHeight?: string;
};

export function BottomSheet({
  open,
  onClose,
  children,
  maxHeight = "72vh",
}: Props) {
  const dragControls = useDragControls();

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
        <div className="absolute inset-0 z-[80] flex flex-col justify-end">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink/35 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 600) onClose();
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING_SHEET}
            className="relative max-h-[var(--sheet-max-h)] overflow-hidden rounded-t-[28px] bg-background shadow-[0_-12px_48px_-8px_rgba(0,0,0,0.18)]"
            style={{ "--sheet-max-h": maxHeight } as CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex cursor-grab justify-center py-3 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
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
