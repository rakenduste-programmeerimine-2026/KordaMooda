"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { useOnline } from "@/lib/connection";
import { snappy } from "@/lib/motion";

type Props = {
  canRemove: boolean;
  onInvite: () => void;
  onRemoveChores: () => void;
  onLeave: () => void;
  onClose: () => void;
};

export function Menu({ canRemove, onInvite, onRemoveChores, onLeave, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);
  const online = useOnline();

  return (
    <Sheet title="Valikud" closeLabel="Sulge" onClose={onClose}>
      <div className="menu">
        <button type="button" className="menu-item" onClick={onInvite}>
          Kutsu kaaslane
        </button>
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
              <p>See seade lahkub kodust. Teised näevad nimekirja edasi.</p>
              <div className="menu-confirm-actions">
                <button
                  type="button"
                  className="button button-danger"
                  disabled={!online}
                  onClick={onLeave}
                >
                  Lahku
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
              key="leave"
              type="button"
              className="menu-item"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              onClick={() => setConfirming(true)}
            >
              Lahku kodust
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </Sheet>
  );
}
