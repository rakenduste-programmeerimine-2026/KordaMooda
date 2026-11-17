"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useState } from "react";
import { Home, type RemoteChange } from "@/components/Home";
import { StartScreen } from "@/components/StartScreen";
import { changedChores, type Household } from "@/lib/household";
import { useHouseholdRealtime } from "@/lib/useHouseholdRealtime";
import { useStayFresh } from "@/lib/useStayFresh";

type Props = {
  /** What the server had when the page was rendered. */
  initial: Household | null;
  /** Whether an old list saved in this browser can be moved to the server (#15). */
  canImport: boolean;
};

export function App({ initial, canImport }: Props) {
  const [household, setHousehold] = useState(initial);
  const [created, setCreated] = useState(false);
  const [remote, setRemote] = useState<RemoteChange | null>(null);

  // A new copy from the server: after joining or leaving (the session cookie changed),
  // or after `refresh`. It is the newest one. Whatever differs from what this phone
  // showed was changed somewhere else, so Home points it out.
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setHousehold(initial);
    if (household && initial && household.id === initial.id) {
      const choreIds = changedChores(household, initial);
      if (choreIds.length > 0) setRemote({ key: (remote?.key ?? 0) + 1, choreIds });
    }
  }

  // Pulls in what the other phone did: when this phone wakes up or gets focus (useStayFresh)
  // and the moment the other phone changes something (Supabase Realtime, #13).
  const refresh = useStayFresh();
  useHouseholdRealtime(household?.id ?? null, refresh);

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
            <Home
              household={household}
              onChange={setHousehold}
              welcome={created}
              remote={remote}
            />
          ) : (
            <StartScreen
              canImport={canImport}
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
