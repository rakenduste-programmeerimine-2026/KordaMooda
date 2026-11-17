"use client";

import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, startTransition, useState, useTransition } from "react";
import { joinHousehold } from "@/lib/actions";
import { type Household, INVITE_CODE_LENGTH, inviteCodeFromInput } from "@/lib/household";
import { snappy } from "@/lib/motion";

type Props = {
  initialCode?: string;
  initialError?: string;
  autoFocus?: boolean;
  onJoined: (household: Household) => void;
};

export function JoinForm({ initialCode = "", initialError = "", autoFocus, onJoined }: Props) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState(initialError);
  const [pending, startJoining] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!code) {
      setError("Kirjuta kutsekood, mille kaaslane sulle saatis.");
      return;
    }
    startJoining(async () => {
      const result = await joinHousehold(code);
      startTransition(() => (result.ok ? onJoined(result.data) : setError(result.error)));
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="field-label" htmlFor="invite-code">
        Kutsekood
      </label>
      <input
        id="invite-code"
        className="text-input code-input"
        value={code}
        placeholder={"•".repeat(INVITE_CODE_LENGTH)}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "invite-code-error" : undefined}
        onChange={(event) => {
          // Upper case, no spaces or dashes; a pasted link is turned into its code.
          setCode(inviteCodeFromInput(event.target.value));
          setError("");
        }}
      />

      <AnimatePresence>
        {error && (
          <motion.p
            id="invite-code-error"
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
        whileTap={{ scale: 0.97 }}
      >
        {pending ? "Liitun…" : "Liitu"}
      </motion.button>
    </form>
  );
}
