"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { snappy } from "@/lib/motion";

type Props = {
  canRemove: boolean;
  onRemoveChores: () => void;
  onStartOver: () => void;
  onClose: () => void;
};

export function Menu({ canRemove, onRemoveChores, onStartOver, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Sheet title="Valikud" closeLabel="Sulge" onClose={onClose}>
      <div className="menu">
        {canRemove && (
          <button type="button" className="menu-item" onClick={onRemoveChores}>
            Eemalda töid
          </button>
        )}
        <AnimatePresence mode="wait" initial={false}>
          {confirming ? (
            <motion.div
              key="confirm"
              className="menu-confirm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={snappy}
            >
              <p>See kustutab selles brauseris kõik inimesed ja tööd.</p>
              <div className="menu-confirm-actions">
                <button type="button" className="button button-danger" onClick={onStartOver}>
                  Kustuta kõik
                </button>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setConfirming(false)}
                >
                  Loobu
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="start-over"
              type="button"
              className="menu-item"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              onClick={() => setConfirming(true)}
            >
              Alusta otsast
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </Sheet>
  );
}
