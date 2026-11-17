"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { type FormEvent, startTransition, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { ImportSaved } from "@/components/ImportSaved";
import { JoinForm } from "@/components/JoinForm";
import { OfflineNotice } from "@/components/OfflineNotice";
import { createHousehold } from "@/lib/actions";
import { callAction, useOnline } from "@/lib/connection";
import {
  cleanMemberNames,
  type Household,
  HouseholdError,
  MAX_MEMBERS,
  MAX_NAME_LENGTH,
} from "@/lib/household";
import { snappy, soft } from "@/lib/motion";

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: soft },
};

function placeholderFor(index: number): string {
  if (index === 0) return "Sinu nimi";
  if (index === 1) return "Kaaslase nimi";
  return "Veel üks nimi";
}

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6, transition: { duration: 0.12 } },
  transition: snappy,
};

type Path = "create" | "join";

const PATHS: { path: Path; label: string; title: string; lead: string }[] = [
  {
    path: "create",
    label: "Loo uus kodu",
    title: "Kes teil kodus töid jagab?",
    lead: "Näed iga kodutöö juures kohe, kelle kord see on.",
  },
  {
    path: "join",
    label: "Mul on kutsekood",
    title: "Liitu kaaslase koduga",
    lead: "Kirjuta kood, mille kaaslane sulle saatis. Siis näete sama nimekirja.",
  },
];

type Props = {
  /** `created` is true for a new household, so the app can offer to invite a partner. */
  onJoined: (household: Household, created: boolean) => void;
};

export function StartScreen({ onJoined }: Props) {
  const [path, setPath] = useState<Path>("create");
  const current = PATHS.find((item) => item.path === path)!;
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

        <OfflineNotice>
          Ühendus puudub. Kodu loomiseks või liitumiseks on vaja internetti.
        </OfflineNotice>

        {/* Imported lists open the invite sheet, like a new household. */}
        <ImportSaved onImported={(household) => onJoined(household, true)} />

        <motion.div variants={rise}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={path} {...fade}>
              <h1>{current.title}</h1>
              <p className="start-lead">{current.lead}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div
          className="start-paths"
          role="group"
          aria-label="Kuidas alustad?"
          variants={rise}
        >
          <LayoutGroup id="start-path">
            {PATHS.map((item) => {
              const chosen = item.path === path;
              return (
                <button
                  key={item.path}
                  type="button"
                  className="start-path"
                  aria-pressed={chosen}
                  onClick={() => setPath(item.path)}
                >
                  {chosen && (
                    <motion.span
                      layoutId="start-path-pill"
                      className="start-path-pill"
                      transition={snappy}
                    />
                  )}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </LayoutGroup>
        </motion.div>

        <motion.div variants={rise}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={path} {...fade}>
              {path === "join" ? (
                <JoinForm autoFocus onJoined={(household) => onJoined(household, false)} />
              ) : (
                <CreateForm onCreated={(household) => onJoined(household, true)} />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </main>
  );
}

function CreateForm({ onCreated }: { onCreated: (household: Household) => void }) {
  const nextKey = useRef(2);
  const [people, setPeople] = useState([
    { key: 0, name: "" },
    { key: 1, name: "" },
  ]);
  const [error, setError] = useState("");
  const [pending, startCreating] = useTransition();
  const online = useOnline();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const names = people.map((person) => person.name);
    try {
      // Same rules as the server, checked here first so mistakes show instantly.
      cleanMemberNames(names);
    } catch (caught) {
      if (!(caught instanceof HouseholdError)) throw caught;
      setError(caught.message);
      return;
    }
    startCreating(async () => {
      const result = await callAction(() => createHousehold(names));
      startTransition(() => (result.ok ? onCreated(result.data) : setError(result.error)));
    });
  }

  return (
    <form onSubmit={submit} noValidate>
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

      <motion.button
        className="button button-primary start-submit"
        aria-disabled={pending || undefined}
        disabled={!online}
        whileTap={{ scale: 0.97 }}
      >
        {pending ? "Hetk…" : "Alusta"}
      </motion.button>
    </form>
  );
}
