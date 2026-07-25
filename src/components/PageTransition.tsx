import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MOTION_COMPONENT_MS } from "@/lib/motion";

type Props = {
  routeKey: string;
  children: React.ReactNode;
};

/** Subtle fade + 6px enter — shared across main tabs. */
export function PageTransition({ routeKey, children }: Props) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (reduced || !mounted) {
    return <div className="page-shell min-h-full bg-white">{children}</div>;
  }

  return (
    <motion.div
      key={routeKey}
      className="page-shell min-h-full bg-white"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: MOTION_COMPONENT_MS / 1000,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
