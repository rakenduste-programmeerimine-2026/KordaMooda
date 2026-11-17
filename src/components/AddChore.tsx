"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { type FormEvent, startTransition, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { Sheet } from "@/components/Sheet";
import { addChore } from "@/lib/actions";
import { callAction, useOnline } from "@/lib/connection";
import {
  cleanChoreName,
  type Household,
  type Id,
  HouseholdError,
  initialsFor,
  MAX_CHORE_LENGTH,
  suggestStarter,
} from "@/lib/household";
import { snappy } from "@/lib/motion";

const COMMON_CHORES = ["Prügi", "Nõud", "Koristamine", "Pesu"];

type Props = {
  household: Household;
  onChange: (household: Household) => void;
  onClose: () => void;
};

export function AddChore({ household, onChange, onClose }: Props) {
  const [name, setName] = useState("");
  const [chosenStarterId, setChosenStarterId] = useState<Id | null>(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");
  const [pending, startAdding] = useTransition();
  const online = useOnline();

  const starterId = chosenStarterId ?? suggestStarter(household).id;
  const suggestions = COMMON_CHORES.filter(
    (chore) => !household.chores.some((existing) => existing.name === chore),
  );

  function add(choreName: string) {
    if (pending) return;
    let cleanName: string;
    try {
      // Same rules as the server, checked here first so mistakes show instantly.
      cleanName = cleanChoreName(household, choreName);
    } catch (caught) {
      if (!(caught instanceof HouseholdError)) throw caught;
      setError(caught.message);
      return;
    }
    startAdding(async () => {
      const result = await callAction(() => addChore(cleanName, starterId));
      startTransition(() => {
        if (!result.ok) {
          if (result.latest) onChange(result.latest);
          setError(result.error);
          return;
        }
        onChange(result.data);
        setAdded(`${cleanName} lisatud.`);
        setName("");
        setChosenStarterId(null);
        setError("");
      });
    });
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
                    disabled={!online}
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
              aria-disabled={pending || undefined}
              disabled={!online}
              whileTap={{ scale: 0.95 }}
              transition={snappy}
            >
              {pending ? "Hetk…" : "Lisa"}
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
