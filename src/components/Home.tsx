"use client";

import { AnimatePresence, motion } from "motion/react";
import { startTransition, useEffect, useOptimistic, useRef, useState } from "react";
import { AddChore } from "@/components/AddChore";
import { ChoreCard } from "@/components/ChoreCard";
import { Invite } from "@/components/Invite";
import { Menu } from "@/components/Menu";
import * as server from "@/lib/actions";
import {
  type Chore,
  type Household,
  type Id,
  markDone,
  nextMember,
  removeChore,
} from "@/lib/household";
import { snappy, soft } from "@/lib/motion";
import type { Result } from "@/lib/result";

const TOAST_MS = 8_000;
/** The button stays under the finger, so a quick second tap must not count again. */
const DONE_COOLDOWN_MS = 800;

type Undo = { kind: "done" | "remove"; choreId: Id };

type Toast = {
  key: number;
  message: string;
  undo?: Undo;
};

/** Shown at once, before the server has answered. */
type Pending = { kind: "done"; choreId: Id; doneAt: string } | { kind: "remove"; choreId: Id };

function applyPending(household: Household, change: Pending): Household {
  return change.kind === "done"
    ? markDone(household, change.choreId, change.doneAt)
    : removeChore(household, change.choreId);
}

type Props = {
  household: Household;
  onChange: (household: Household | null) => void;
  /** Opens the invite sheet straight away, right after a new household was created. */
  welcome?: boolean;
};

export function Home({ household: saved, onChange, welcome = false }: Props) {
  // While a change is on its way to the server, the screen already shows it.
  // If the server says no, React drops it and the saved copy shows again.
  const [household, showPending] = useOptimistic(saved, applyPending);
  const { members, chores } = household;
  const [now, setNow] = useState(() => new Date().toISOString());
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<"add" | "menu" | "invite" | null>(welcome ? "invite" : null);
  const [welcoming, setWelcoming] = useState(welcome);
  const [toast, setToast] = useState<Toast | null>(null);

  const toastRef = useRef<HTMLDivElement>(null);
  const topButtonRef = useRef<HTMLButtonElement>(null);
  const toastKey = useRef(0);
  const coolingDown = useRef(new Set<Id>());

  function showToast(message: string, undo?: Undo) {
    toastKey.current += 1;
    setToast({ key: toastKey.current, message, undo });
  }

  /** Sends a change to the server and keeps the screen in step with its answer. */
  function send<T>(
    change: Pending | null,
    request: () => Promise<Result<T>>,
    onSuccess: (data: T) => void,
  ) {
    startTransition(async () => {
      if (change) showPending(change);
      const result = await request();
      startTransition(() => {
        if (result.ok) {
          onSuccess(result.data);
        } else {
          // Someone else changed it first: show their version, not our old copy.
          if (result.latest) onChange(result.latest);
          showToast(result.error);
        }
      });
    });
  }

  // A phone can keep this page open overnight, so "täna" has to become "eile".
  useEffect(() => {
    function refreshDate() {
      if (!document.hidden) setNow(new Date().toISOString());
    }
    document.addEventListener("visibilitychange", refreshDate);
    return () => document.removeEventListener("visibilitychange", refreshDate);
  }, []);

  useEffect(() => {
    if (!toast) return;
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      if (toastRef.current?.contains(document.activeElement)) {
        timer = setTimeout(expire, 2_000);
      } else {
        setToast(null);
      }
    };
    timer = setTimeout(expire, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleDone(chore: Chore) {
    if (coolingDown.current.has(chore.id)) return;
    coolingDown.current.add(chore.id);
    setTimeout(() => coolingDown.current.delete(chore.id), DONE_COOLDOWN_MS);

    const doneAt = new Date().toISOString();
    setNow(doneAt);
    const next = nextMember(members, chore.currentMemberId);
    showToast(`${chore.name} tehtud. Järgmine: ${next.name}.`, {
      kind: "done",
      choreId: chore.id,
    });
    // `currentMemberId` is whose turn this phone showed, so a second phone can't skip a person.
    send(
      { kind: "done", choreId: chore.id, doneAt },
      () => server.markDone(chore.id, chore.currentMemberId),
      onChange,
    );
  }

  function handleUndo({ undo }: Toast) {
    if (!undo) return;
    const request =
      undo.kind === "done"
        ? () => server.undoDone(undo.choreId)
        : () => server.undoRemoveChore(undo.choreId);
    setToast(null);
    send(null, request, (updated) => {
      onChange(updated);
      showToast("Tagasi võetud.");
      requestAnimationFrame(() => {
        const target = document.querySelector<HTMLButtonElement>(
          `[data-chore="${undo.choreId}"] button`,
        );
        (target ?? topButtonRef.current)?.focus();
      });
    });
  }

  function handleRemove(chore: Chore) {
    showToast(`${chore.name} eemaldatud.`, { kind: "remove", choreId: chore.id });
    if (chores.length === 1) setEditing(false);
    topButtonRef.current?.focus();
    send({ kind: "remove", choreId: chore.id }, () => server.removeChore(chore.id), onChange);
  }

  function handleLeave() {
    send(null, server.leaveHousehold, () => onChange(null));
  }

  return (
    <main className="home">
      <header className="topbar">
        <p className="wordmark">
          <span className="wordmark-mark" aria-hidden />
          KordaMööda
        </p>
        <button
          ref={topButtonRef}
          type="button"
          className="button button-quiet"
          onClick={() => (editing ? setEditing(false) : setSheet("menu"))}
        >
          {editing ? "Valmis" : "Valikud"}
        </button>
      </header>

      {chores.length === 0 ? (
        <motion.section
          className="empty"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={soft}
        >
          <h1>Lisa esimene töö</h1>
          <p>Siis näed kohe, kelle kord see on.</p>
          <motion.button
            type="button"
            className="button button-primary"
            whileTap={{ scale: 0.96 }}
            onClick={() => setSheet("add")}
          >
            Lisa töö
          </motion.button>
        </motion.section>
      ) : (
        <motion.ul
          className="cards"
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.05 }}
        >
          <AnimatePresence mode="popLayout">
            {chores.map((chore) => (
              <ChoreCard
                key={chore.id}
                chore={chore}
                members={members}
                now={now}
                editing={editing}
                onDone={() => handleDone(chore)}
                onRemove={() => handleRemove(chore)}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <div className="fab-region">
        <AnimatePresence>
          {chores.length > 0 && !editing && !toast && (
            <motion.button
              type="button"
              className="fab"
              initial={{ scale: 0.8, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 12, transition: { duration: 0.14 } }}
              whileTap={{ scale: 0.93 }}
              transition={soft}
              onClick={() => setSheet("add")}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                <path
                  d="M12 5v14M5 12h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Lisa töö
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="toast-region" role="status">
        <AnimatePresence mode="popLayout">
          {toast && (
            <motion.div
              key={toast.key}
              ref={toastRef}
              className="toast"
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={snappy}
            >
              <span>{toast.message}</span>
              {toast.undo && (
                <button
                  type="button"
                  className="button button-toast"
                  onClick={() => handleUndo(toast)}
                >
                  Võta tagasi
                </button>
              )}
              <motion.span
                className="toast-timer"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: TOAST_MS / 1000, ease: "linear" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {sheet === "add" && (
          <AddChore
            key="add"
            household={household}
            onChange={onChange}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === "invite" && (
          <Invite
            key="invite"
            code={household.inviteCode}
            welcome={welcoming}
            onNewCode={(inviteCode) => onChange({ ...saved, inviteCode })}
            onClose={() => {
              setSheet(null);
              setWelcoming(false);
            }}
          />
        )}
        {sheet === "menu" && (
          <Menu
            key="menu"
            canRemove={chores.length > 0}
            onInvite={() => setSheet("invite")}
            onRemoveChores={() => {
              setEditing(true);
              setSheet(null);
            }}
            onLeave={handleLeave}
            onClose={() => setSheet(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
