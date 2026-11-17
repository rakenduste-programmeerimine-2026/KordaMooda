"use client";

import { AnimatePresence, motion } from "motion/react";
import { startTransition, useState, useTransition } from "react";
import { importHousehold } from "@/lib/actions";
import { callAction, useOnline } from "@/lib/connection";
import { type Household, HouseholdError, householdFromSaved } from "@/lib/household";
import { snappy, soft } from "@/lib/motion";
import { forgetSavedList, useSavedList } from "@/lib/savedList";

const listFormat = new Intl.ListFormat("et", { type: "conjunction" });

function preview(saved: string): Household | null {
  try {
    return householdFromSaved(saved);
  } catch (caught) {
    if (caught instanceof HouseholdError) return null;
    throw caught;
  }
}

/**
 * Offers to move a list that an earlier version kept only in this browser (#15).
 * Shown on the start screen, so only when the server has no household for this device.
 */
export function ImportSaved({ onImported }: { onImported: (household: Household) => void }) {
  const saved = useSavedList();
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState("");
  const [pending, startImporting] = useTransition();
  const online = useOnline();

  const found = saved ? preview(saved) : null;
  const choreCount = found?.chores.length ?? 0;

  function importList() {
    if (!saved || pending) return;
    setError("");
    startImporting(async () => {
      const result = await callAction(() => importHousehold(saved));
      startTransition(() => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        forgetSavedList();
        onImported(result.data);
      });
    });
  }

  return (
    <AnimatePresence initial={false}>
      {found && !hidden && (
        <motion.section
          className="import-card"
          aria-labelledby="import-title"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0, paddingBlock: 0 }}
          transition={soft}
        >
          <h2 id="import-title">Sinu varasem nimekiri on alles</h2>
          <p>
            Selles brauseris on nimekiri, kus on{" "}
            {listFormat.format(found.members.map((member) => member.name))}
            {choreCount > 0 && `, ${choreCount} ${choreCount === 1 ? "töö" : "tööd"}`}. Vii see
            üle, siis saad kaaslase ka teisest telefonist kutsuda.
          </p>
          {error && (
            <motion.p
              className="form-error"
              role="alert"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={snappy}
            >
              {error}
            </motion.p>
          )}
          <div className="import-actions">
            <motion.button
              type="button"
              className="button button-primary"
              aria-disabled={pending || undefined}
              disabled={!online}
              whileTap={{ scale: 0.97 }}
              onClick={importList}
            >
              {pending ? "Hetk…" : "Vii nimekiri üle"}
            </motion.button>
            <button type="button" className="button button-quiet" onClick={() => setHidden(true)}>
              Alusta uuesti
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
