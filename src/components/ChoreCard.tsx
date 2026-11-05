"use client";

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type PanInfo,
  useMotionValue,
  useTransform,
} from "motion/react";
import { type Ref, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { type Chore, initialsFor, type Member, relativeDay } from "@/lib/household";
import { snappy, soft } from "@/lib/motion";

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 700;
/** Longer names get smaller type so they fit without breaking inside a word. */
const LONG_NAME_LENGTH = 14;

export const cardEntrance = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: soft },
};

type Props = {
  chore: Chore;
  members: Member[];
  now: string;
  editing: boolean;
  onDone: () => void;
  onRemove: () => void;
  ref?: Ref<HTMLLIElement>;
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        d="M5 12.5 10 17.5 19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChoreCard({ chore, members, now, editing, onDone, onRemove, ref }: Props) {
  const [pulse, setPulse] = useState(0);
  const x = useMotionValue(0);
  const revealOpacity = useTransform(x, [0, SWIPE_DISTANCE * 0.7], [0, 1]);

  const tone = members.findIndex((member) => member.id === chore.currentMemberId);
  const current = members[tone];
  const lastName = members.find((member) => member.id === chore.last?.memberId)?.name;
  const lastLabel = chore.last
    ? `Eelmine: ${lastName}, ${relativeDay(chore.last.doneAt, now)}`
    : "Pole veel tehtud";

  function handleDone() {
    setPulse((count) => count + 1);
    onDone();
  }

  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) handleDone();
  }

  return (
    <motion.li
      ref={ref}
      className="card-slot"
      data-tone={tone}
      data-chore={chore.id}
      layout="position"
      variants={cardEntrance}
      // Other cards slide in under this one while it fades, so it must not catch taps.
      exit={{ opacity: 0, scale: 0.9, pointerEvents: "none", transition: { duration: 0.18 } }}
      transition={soft}
    >
      <motion.div className="swipe-reveal" style={{ opacity: revealOpacity }} aria-hidden>
        <CheckIcon />
        Tehtud
      </motion.div>

      <motion.article
        className="card"
        style={{ x }}
        drag={editing ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.7 }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 32 }}
        onDragEnd={handleDragEnd}
      >
        <div className="card-top">
          <h2 className="card-chore">{chore.name}</h2>
          <div className="swap card-last">
            <AnimatePresence initial={false}>
              <motion.p
                key={lastLabel}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={snappy}
              >
                {lastLabel}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <p className="swap card-name" data-long={current.name.length > LONG_NAME_LENGTH || undefined}>
          <span className="visually-hidden">Kord: </span>
          <AnimatePresence initial={false}>
            <motion.span
              key={current.id}
              className="card-name-value"
              initial={{ opacity: 0, y: "70%", filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: "-70%", filter: "blur(6px)" }}
              transition={soft}
            >
              {current.name}
            </motion.span>
          </AnimatePresence>
        </p>

        <div className="card-bottom">
          <LayoutGroup id={`chore-${chore.id}`}>
            <ol
              className="queue"
              aria-label={`Järjekord: ${members.map((member) => member.name).join(", ")}`}
            >
              {members.map((member, index) => {
                const isCurrent = member.id === current.id;
                return (
                  <li key={member.id} className="queue-item" data-current={isCurrent || undefined}>
                    {isCurrent && (
                      <motion.span
                        layoutId="turn-ring"
                        className="queue-ring"
                        data-tone={index}
                        transition={soft}
                      />
                    )}
                    <Avatar initials={initialsFor(members, member)} tone={index} />
                  </li>
                );
              })}
            </ol>
          </LayoutGroup>

          {editing ? (
            <motion.button
              type="button"
              className="button button-danger"
              aria-label={`Eemalda ${chore.name}`}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.94 }}
              transition={snappy}
              onClick={onRemove}
            >
              Eemalda
            </motion.button>
          ) : (
            <motion.button
              type="button"
              className="button button-done"
              aria-label={`${chore.name} tehtud`}
              initial={false}
              whileTap={{ scale: 0.92 }}
              transition={snappy}
              onClick={handleDone}
            >
              {pulse > 0 && (
                <motion.span
                  key={pulse}
                  className="button-pulse"
                  initial={{ scale: 0.4, opacity: 0.45 }}
                  animate={{ scale: 2.4, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              )}
              <CheckIcon />
              Tehtud
            </motion.button>
          )}
        </div>
      </motion.article>
    </motion.li>
  );
}
