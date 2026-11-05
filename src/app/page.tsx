"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { Home } from "@/components/Home";
import { StartScreen } from "@/components/StartScreen";
import { useHousehold } from "@/lib/useHousehold";

export default function Page() {
  const household = useHousehold();

  if (household === undefined) return null;

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={household ? "home" : "start"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {household ? <Home household={household} /> : <StartScreen />}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
