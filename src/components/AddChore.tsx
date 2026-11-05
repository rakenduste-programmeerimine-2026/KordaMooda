"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { type FormEvent, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Sheet } from "@/components/Sheet";
import {
  addChore,
  type Household,
  HouseholdError,
  initialsFor,
  MAX_CHORE_LENGTH,
  suggestStarter,
} from "@/lib/household";
import { snappy } from "@/lib/motion";
import { saveHousehold } from "@/lib/useHousehold";

const COMMON_CHORES = ["Prügi", "Nõud", "Koristamine", "Pesu"];

type Props = {
  household: Household;
  onClose: () => void;
};

export function AddChore({ household, onClose }: Props) {
  const [name, setName] = useState("");
  const [chosenStarterId, setChosenStarterId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");

  const starterId = chosenStarterId ?? suggestStarter(household).id;
  const suggestions = COMMON_CHORES.filter(
    (chore) => !household.chores.some((existing) => existing.name === chore),
  );

  function add(choreName: string) {
    try {
      saveHousehold(addChore(household, choreName, starterId));
      setAdded(`${choreName.trim()} lisatud.`);
      setName("");
      setChosenStarterId(null);
      setError("");
    } catch (caught) {
      if (!(caught instanceof HouseholdError)) throw caught;
      setError(caught.message);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    add(name);
  }

  return (
    <Sheet title="Lisa töö" closeLabel="Valmis" onClose={onClose}>
      <div className="add">
        <fieldset className="field">
          <legend>Kes alustab?</legend>
          <LayoutGroup id="starter">
            <div className="starters">
              {household.members.map((member, index) => {
                const checked = member.id === starterId;
                return (
                  <label key={member.id} className="starter" data-tone={index}>
                    <input
                      type="radio"
                      name="starter"
                      checked={checked}
                      onChange={() => setChosenStarterId(member.id)}
                    />
                    {checked && (
                      <motion.span
                        layoutId="starter-pill"
                        className="starter-pill"
                        transition={snappy}
                      />
                    )}
                    <Avatar initials={initialsFor(household.members, member)} tone={index} />
                    <span className="starter-name">{member.name}</span>
                  </label>
                );
              })}
            </div>
          </LayoutGroup>
        </fieldset>

        {suggestions.length > 0 && (
          <div className="field">
            <p className="field-label" id="suggestions-label">
              Lisa ühe puudutusega
            </p>
            <div className="suggestions" role="group" aria-labelledby="suggestions-label">
              <AnimatePresence mode="popLayout" initial={false}>
                {suggestions.map((chore) => (
                  <motion.button
                    key={chore}
                    layout
                    type="button"
                    className="button button-chip"
                    aria-label={`Lisa ${chore}`}
                    exit={{ opacity: 0, scale: 0.7 }}
                    whileTap={{ scale: 0.94 }}
                    transition={snappy}
                    onClick={() => add(chore)}
                  >
                    {chore}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        <form className="field" onSubmit={submit} noValidate>
          <label className="field-label" htmlFor="chore-name">
            {suggestions.length > 0 ? "Või kirjuta oma" : "Töö nimi"}
          </label>
          <div className="add-row">
            <input
              id="chore-name"
              className="text-input"
              value={name}
              maxLength={MAX_CHORE_LENGTH}
              autoComplete="off"
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
            />
            <motion.button
              className="button button-primary"
              whileTap={{ scale: 0.95 }}
              transition={snappy}
            >
              Lisa
            </motion.button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>

        <p className="visually-hidden" role="status">
          {added}
        </p>
      </div>
    </Sheet>
  );
}
