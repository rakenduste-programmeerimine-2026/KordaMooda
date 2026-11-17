"use client";

import { AnimatePresence, motion } from "motion/react";
import { startTransition, useRef, useState, useTransition } from "react";
import { Sheet } from "@/components/Sheet";
import { newInviteCode } from "@/lib/actions";
import { formatInviteCode, invitePath } from "@/lib/household";
import { snappy } from "@/lib/motion";

const COPIED_MS = 2_500;

type Props = {
  code: string;
  /** Right after creating a household the text is a bit more welcoming. */
  welcome?: boolean;
  onNewCode: (code: string) => void;
  onClose: () => void;
};

/** Phones get the system share sheet; computers just copy the link. */
function canShare(): boolean {
  return typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches;
}

export function Invite({ code, welcome, onNewCode, onClose }: Props) {
  const link = `${location.origin}${invitePath(code)}`;
  const [share] = useState(canShare);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startRenewing] = useTransition();
  const linkRef = useRef<HTMLInputElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function flash(message: string) {
    setStatus(message);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(""), COPIED_MS);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      flash("Link kopeeritud.");
    } catch {
      // No clipboard access (e.g. plain http on a phone): select it so it can be copied by hand.
      linkRef.current?.select();
      flash("Kopeeri valitud link käsitsi.");
    }
  }

  async function shareLink() {
    try {
      await navigator.share({
        title: "KordaMööda",
        text: "Liitu meie kodutööde järjekorraga:",
        url: link,
      });
    } catch (caught) {
      // Closing the share sheet is not an error.
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      void copy();
    }
  }

  function renew() {
    setError("");
    startRenewing(async () => {
      const result = await newInviteCode();
      startTransition(() => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onNewCode(result.data);
        setConfirming(false);
        flash("Uus kood on valmis. Vana enam ei tööta.");
      });
    });
  }

  return (
    <Sheet title="Kutsu kaaslane" closeLabel={welcome ? "Hiljem" : "Valmis"} onClose={onClose}>
      <div className="invite">
        <p className="invite-lead">
          {welcome
            ? "Kodu on loodud. Saada link kaaslasele, siis näete mõlemad sama nimekirja."
            : "Kui kaaslane avab lingi, näeb ta sama nimekirja ja saab töid tehtuks märkida."}
        </p>

        <div className="invite-code">
          <p className="field-label" id="invite-code-label">
            Kutsekood
          </p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={code}
              className="invite-code-value"
              aria-labelledby="invite-code-label"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={snappy}
            >
              {formatInviteCode(code)}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="invite-link">
            Link
          </label>
          <input
            ref={linkRef}
            id="invite-link"
            className="text-input invite-link"
            value={link}
            readOnly
            onFocus={(event) => event.target.select()}
          />
        </div>

        <div className="invite-actions">
          {share && (
            <motion.button
              type="button"
              className="button button-primary"
              whileTap={{ scale: 0.96 }}
              onClick={shareLink}
            >
              Saada link
            </motion.button>
          )}
          <motion.button
            type="button"
            className={share ? "button button-quiet" : "button button-primary"}
            whileTap={{ scale: 0.96 }}
            onClick={copy}
          >
            Kopeeri link
          </motion.button>
        </div>

        <p className="invite-status" role="status">
          {status}
        </p>

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
              <p>Vana kood ja link lakkavad töötamast. Kes on juba liitunud, jääb koju edasi.</p>
              <div className="menu-confirm-actions">
                <button
                  type="button"
                  className="button button-danger"
                  aria-disabled={pending || undefined}
                  onClick={() => !pending && renew()}
                >
                  {pending ? "Hetk…" : "Tee uus kood"}
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
              key="renew"
              type="button"
              className="menu-item"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              onClick={() => setConfirming(true)}
            >
              Uus kood
            </motion.button>
          )}
        </AnimatePresence>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
