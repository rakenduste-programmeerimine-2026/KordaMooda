"use client";

import { motion, type PanInfo, useDragControls } from "motion/react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { soft } from "@/lib/motion";

type Props = {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
};

const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 500;

/** A panel that rises from the bottom. Render it inside AnimatePresence. */
export function Sheet({ title, closeLabel, onClose, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const dragControls = useDragControls();

  // showModal handles the focus trap, Esc and returning focus on close.
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <motion.div
        className="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      />
      <motion.div
        className="sheet-panel"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={soft}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.8 }}
        onDragEnd={handleDragEnd}
      >
        <div
          className="sheet-grip"
          aria-hidden
          onPointerDown={(event) => dragControls.start(event)}
        >
          <span />
        </div>
        <header className="sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="button button-quiet" onClick={onClose}>
            {closeLabel}
          </button>
        </header>
        {children}
      </motion.div>
    </dialog>
  );
}
