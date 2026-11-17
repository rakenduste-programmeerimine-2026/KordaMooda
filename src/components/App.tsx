"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useState } from "react";
import { Home } from "@/components/Home";
import { StartScreen } from "@/components/StartScreen";
import type { Household } from "@/lib/household";

type Props = {
  /** What the server had when the page was rendered. */
  initial: Household | null;
};

export function App({ initial }: Props) {
  const [household, setHousehold] = useState(initial);
  const [created, setCreated] = useState(false);

  // The server renders the page again when this device joins or leaves a household
  // (the session cookie changes). Its copy is then the newest one.
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setHousehold(initial);
  }

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
          {household ? (
            <Home household={household} onChange={setHousehold} welcome={created} />
          ) : (
            <StartScreen
              onJoined={(joined, isNew) => {
                setCreated(isNew);
                setHousehold(joined);
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
