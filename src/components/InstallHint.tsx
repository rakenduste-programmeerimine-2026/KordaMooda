"use client";

import { AnimatePresence, motion } from "motion/react";
import { dismissInstallHint, promptInstall, useInstallHint } from "@/lib/install";
import { soft } from "@/lib/motion";

function ShareIcon() {
  return (
    <svg className="install-share" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M12 15V3M8 7l4-4 4 4M6 11H5v10h14V11h-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Suggests putting the app on the home screen, so it opens in one tap (#20). */
export function InstallHint() {
  const hint = useInstallHint();

  return (
    <AnimatePresence>
      {hint !== "none" && (
        <motion.aside
          className="install-hint"
          aria-label="Lisa avakuvale"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0, paddingBlock: 0 }}
          transition={soft}
        >
          <span className="install-icon" aria-hidden />
          <div className="install-text">
            <p className="install-title">Pane KordaMööda avakuvale</p>
            {hint === "ios" ? (
              <p>
                Vajuta Safaris Jaga-nuppu <ShareIcon /> ja vali „Lisa avakuvale“. Siis näed ühe
                puudutusega, kelle kord on.
              </p>
            ) : (
              <p>Siis näed ühe puudutusega, kelle kord on.</p>
            )}
          </div>
          <div className="install-actions">
            {hint === "prompt" && (
              <button type="button" className="button button-primary" onClick={promptInstall}>
                Lisa
              </button>
            )}
            <button type="button" className="button button-quiet" onClick={dismissInstallHint}>
              {hint === "ios" ? "Selge" : "Hiljem"}
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
