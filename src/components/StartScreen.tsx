"use client";

import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import {
  createHousehold,
  HouseholdError,
  MAX_MEMBERS,
  MAX_NAME_LENGTH,
} from "@/lib/household";
import { snappy, soft } from "@/lib/motion";
import { saveHousehold } from "@/lib/useHousehold";

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: soft },
};

function placeholderFor(index: number): string {
  if (index === 0) return "Sinu nimi";
  if (index === 1) return "Kaaslase nimi";
  return "Veel üks nimi";
}

export function StartScreen() {
  const nextKey = useRef(2);
  const [people, setPeople] = useState([
    { key: 0, name: "" },
    { key: 1, name: "" },
  ]);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      saveHousehold(createHousehold(people.map((person) => person.name)));
    } catch (caught) {
      if (!(caught instanceof HouseholdError)) throw caught;
      setError(caught.message);
    }
  }

  return (
    <main className="start">
      <div className="start-glow" aria-hidden>
        <span />
        <span />
      </div>

      <motion.div
        className="start-content"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.07 }}
      >
        <motion.p className="wordmark" variants={rise}>
          <span className="wordmark-mark" aria-hidden />
          KordaMööda
        </motion.p>
        <motion.h1 variants={rise}>Kes teil kodus töid jagab?</motion.h1>
        <motion.p className="start-lead" variants={rise}>
          Näed iga kodutöö juures kohe, kelle kord see on.
        </motion.p>

        <motion.form variants={rise} onSubmit={submit} noValidate>
          <ul className="people">
            <AnimatePresence initial={false}>
              {people.map((person, index) => (
                <motion.li
                  key={person.key}
                  layout="position"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={snappy}
                >
                  <div className="person">
                    <motion.span
                      key={Array.from(person.name.trim())[0] ?? ""}
                      initial={{ scale: 0.6 }}
                      animate={{ scale: 1 }}
                      transition={snappy}
                    >
                      <Avatar
                        tone={index}
                        size="medium"
                        initials={Array.from(person.name.trim())[0]?.toLocaleUpperCase("et") ?? ""}
                      />
                    </motion.span>
                    <input
                      aria-label={placeholderFor(index)}
                      placeholder={placeholderFor(index)}
                      value={person.name}
                      maxLength={MAX_NAME_LENGTH}
                      autoComplete="off"
                      autoCapitalize="words"
                      // Only people added with the button mount after the page has loaded.
                      autoFocus={index >= 2}
                      onChange={(event) => {
                        const name = event.target.value;
                        setError("");
                        setPeople((current) =>
                          current.map((item) =>
                            item.key === person.key ? { ...item, name } : item,
                          ),
                        );
                      }}
                    />
                    {index >= 2 && (
                      <button
                        type="button"
                        className="button button-quiet"
                        aria-label={`Eemalda ${person.name || "see rida"}`}
                        onClick={() =>
                          setPeople((current) => current.filter((item) => item.key !== person.key))
                        }
                      >
                        Eemalda
                      </button>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {people.length < MAX_MEMBERS && (
            <button
              type="button"
              className="button button-quiet start-more"
              onClick={() => {
                const key = nextKey.current++;
                setPeople((current) => [...current, { key, name: "" }]);
              }}
            >
              Lisa veel üks inimene
            </button>
          )}

          <AnimatePresence>
            {error && (
              <motion.p
                className="form-error"
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={snappy}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button className="button button-primary start-submit" whileTap={{ scale: 0.97 }}>
            Alusta
          </motion.button>
        </motion.form>
      </motion.div>
    </main>
  );
}
