import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MOTION_SLOW_MS, MOTION_EASE } from "@/lib/motion";

type Props = {
  routeKey: string;
  children: React.ReactNode;
};

/** Screen enter — opacity + 8px, --dur-slow / --ease-out. */
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: MOTION_SLOW_MS / 1000,
        ease: MOTION_EASE,
      }}
    >
      {children}
    </motion.div>
  );
}
