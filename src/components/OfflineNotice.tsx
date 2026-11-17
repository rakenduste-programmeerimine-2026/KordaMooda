"use client";

import { AnimatePresence, motion } from "motion/react";
import { useOnline } from "@/lib/connection";
import { snappy } from "@/lib/motion";

function WifiOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        d="M3 3l18 18M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.3-2.6M19 12.9a10 10 0 0 0-2.9-2M1.6 9.2a15 15 0 0 1 4.7-2.9M22.4 9.2A15 15 0 0 0 11 5.1M12 20h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A calm banner while the device is offline. Renders nothing when online. */
export function OfflineNotice({ children }: { children: string }) {
  const online = useOnline();

  return (
    <div role="status">
      <AnimatePresence initial={false}>
        {!online && (
          <motion.div
            className="notice-slot"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={snappy}
          >
            <p className="notice">
              <WifiOffIcon />
              <span>{children}</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
